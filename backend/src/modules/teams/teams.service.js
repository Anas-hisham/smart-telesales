const { pool, runInTransaction } = require('../../config/db');
const { Errors } = require('../../utils/errors');
const { findUser, findUsers, formatUserForApi } = require('../../utils/user');
const { notifyUsers } = require('../../utils/notify');

const formatTeamForApi = (teamRow) => ({ id: teamRow.id, name: teamRow.name, leaderId: teamRow.leader_id, agentIds: teamRow.agent_ids || [], managerId: teamRow.manager_id || '' });

const TEAM_SELECT = `
  SELECT t.*, COALESCE(array_agg(a.id ORDER BY a.name) FILTER (WHERE a.id IS NOT NULL), '{}') AS agent_ids
  FROM teams t LEFT JOIN users a ON a.team_id = t.id AND a.role = 'agent' AND a.active`;

async function listTeams(db = pool) {
  const { rows } = await db.query(`${TEAM_SELECT} GROUP BY t.id ORDER BY t.name`);
  return rows.map(formatTeamForApi);
}
async function getTeam(id, db = pool) {
  const { rows } = await db.query(`${TEAM_SELECT} WHERE t.id = $1 GROUP BY t.id`, [id]);
  if (!rows[0]) throw Errors.notFound('Team');
  return formatTeamForApi(rows[0]);
}

/** Line of business of a team = the one of its Operation Manager (null when it has no manager) */
async function getTeamLineOfBusiness(teamId, db = pool) {
  const { rows } = await db.query('SELECT m.lob FROM teams t LEFT JOIN users m ON m.id = t.manager_id WHERE t.id = $1', [teamId]);
  if (!rows.length) throw Errors.notFound('Team');
  return rows[0].lob || null;
}

async function qualityChoicesForTeam(teamId) {
  const lineOfBusiness = await getTeamLineOfBusiness(teamId);
  if (!lineOfBusiness) return [];
  return (await findUsers(`u.role='quality' AND u.active AND u.lob = $1`, [lineOfBusiness])).map(formatUserForApi);
}
async function qualityChoicesForAgent(agentId) {
  const agent = await findUser(agentId);
  if (!agent || agent.role !== 'agent') throw Errors.notFound('Agent');
  return qualityChoicesForTeam(agent.team_id);
}

/** If the agent's Quality is of another line than `lob`, take the Quality away and tell both. Returns true when removed. */
async function removeQualityIfDifferentLineOfBusiness(dbClient, agent, lineOfBusiness) {
  if (!lineOfBusiness || !agent.quality_id) return false;
  const qualityUser = await findUser(agent.quality_id, dbClient);
  if (qualityUser && qualityUser.lob === lineOfBusiness) return false;
  await dbClient.query('UPDATE users SET quality_id = NULL WHERE id = $1', [agent.id]);
  await notifyUsers(dbClient, [agent.id], { type: 'update', title: 'Your Quality changed', message: 'You no longer have a Quality member' });
  await notifyUsers(dbClient, [agent.quality_id], { type: 'update', title: 'An agent left your agents', message: `${agent.name} is no longer one of your agents` });
  return true;
}

async function moveAgentToTeam(agentId, toTeamId) {
  return runInTransaction(async (dbClient) => {
    const agent = await findUser(agentId, dbClient);
    if (!agent || agent.role !== 'agent') throw Errors.notFound('Agent');
    const { rows: [targetTeam] } = await dbClient.query('SELECT * FROM teams WHERE id = $1', [toTeamId]);
    if (!targetTeam) throw Errors.notFound('Team');
    if (agent.team_id !== toTeamId) {
      const { rows: [previousTeam] } = await dbClient.query('SELECT * FROM teams WHERE id = $1', [agent.team_id]);
      await dbClient.query('UPDATE users SET team_id = $2 WHERE id = $1', [agentId, toTeamId]);
      await notifyUsers(dbClient, [agentId], { type: 'update', title: 'You moved to a new team', message: `You are now in team ${targetTeam.name}` });
      await notifyUsers(dbClient, [targetTeam.leader_id], { type: 'update', title: 'New agent in your team', message: `${agent.name} joined your team` });
      if (previousTeam) await notifyUsers(dbClient, [previousTeam.leader_id], { type: 'update', title: 'An agent left your team', message: `${agent.name} moved to team ${targetTeam.name}` });
      await removeQualityIfDifferentLineOfBusiness(dbClient, agent, await getTeamLineOfBusiness(toTeamId, dbClient));
    }
    return { agent: formatUserForApi(await findUser(agentId, dbClient)), teams: await listTeams(dbClient) };
  });
}

async function assignManagerToTeam(teamId, managerId) {
  return runInTransaction(async (dbClient) => {
    const { rows: [team] } = await dbClient.query('SELECT * FROM teams WHERE id = $1 FOR UPDATE', [teamId]);
    if (!team) throw Errors.notFound('Team');
    if (managerId) {
      const managerUser = await findUser(managerId, dbClient);
      if (!managerUser || managerUser.role !== 'operation_manager' || !managerUser.active) throw Errors.validation([{ field: 'managerId', message: 'Not an Operation Manager' }]);
    }
    const agentIdsWithRemovedQuality = [];
    if ((team.manager_id || null) !== (managerId || null)) {
      await dbClient.query('UPDATE teams SET manager_id = $2 WHERE id = $1', [teamId, managerId || null]);
      await notifyUsers(dbClient, [team.manager_id], { type: 'update', title: 'A team left your management', message: `Team ${team.name} is no longer under your management` });
      await notifyUsers(dbClient, [managerId], { type: 'update', title: 'A team joined your management', message: `Team ${team.name} is now under your management` });
      await notifyUsers(dbClient, [team.leader_id], { type: 'update', title: 'Your team has a new manager', message: 'The Operation Manager of your team changed' });
      if (managerId) {
        const lineOfBusiness = await getTeamLineOfBusiness(teamId, dbClient);
        const agents = await findUsers(`u.role='agent' AND u.team_id = $1 AND u.quality_id IS NOT NULL`, [teamId], dbClient);
        for (const agent of agents) if (await removeQualityIfDifferentLineOfBusiness(dbClient, agent, lineOfBusiness)) agentIdsWithRemovedQuality.push(agent.id);
      }
    }
    const agents = agentIdsWithRemovedQuality.length ? await findUsers('u.id = ANY($1::uuid[])', [agentIdsWithRemovedQuality], dbClient) : [];
    return { team: await getTeam(teamId, dbClient), changedAgents: agents.map(formatUserForApi) };
  });
}

async function assignQualityToAgent(agentId, qualityId) {
  return runInTransaction(async (dbClient) => {
    const agent = await findUser(agentId, dbClient);
    if (!agent || agent.role !== 'agent') throw Errors.notFound('Agent');
    if (qualityId) {
      const qualityUser = await findUser(qualityId, dbClient);
      if (!qualityUser || qualityUser.role !== 'quality' || !qualityUser.active) throw Errors.validation([{ field: 'qualityId', message: 'Not a Quality member' }]);
      if (!agent.eff_lob) throw Errors.validation([{ field: 'qualityId', message: 'His team has no manager, so he has no line of business yet' }]);
      if (qualityUser.lob !== agent.eff_lob) throw Errors.validation([{ field: 'qualityId', message: 'The Quality member is of another line of business' }]);
    }
    if ((agent.quality_id || null) !== (qualityId || null)) {
      await dbClient.query('UPDATE users SET quality_id = $2 WHERE id = $1', [agentId, qualityId || null]);
      await notifyUsers(dbClient, [agentId], { type: 'update', title: 'Your Quality changed', message: 'A new Quality member follows you' });
      await notifyUsers(dbClient, [qualityId], { type: 'update', title: 'New agent to follow', message: `${agent.name} is now one of your agents` });
      await notifyUsers(dbClient, [agent.quality_id], { type: 'update', title: 'An agent left your agents', message: `${agent.name} is no longer one of your agents` });
    }
    return formatUserForApi(await findUser(agentId, dbClient));
  });
}

module.exports = { listTeams, getTeam, qualityChoicesForTeam, qualityChoicesForAgent, moveAgentToTeam, assignManagerToTeam, assignQualityToAgent };
