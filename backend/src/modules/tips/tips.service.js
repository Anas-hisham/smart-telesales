const { query, runInTransaction } = require('../../config/db');
const { Errors } = require('../../utils/errors');
const { uniqueNonEmpty } = require('../../utils/helpers');
const { findUsers, formatUserForApi, getUserNamesById } = require('../../utils/user');
const { visibleAgentIds } = require('../../utils/scope');
const { notifyUsers } = require('../../utils/notify');

async function formatTipsForApi(rows) {
  const names = await getUserNamesById(rows.map((tipRow) => tipRow.author_id));
  return rows.map((tipRow) => ({
    id: tipRow.id, authorId: tipRow.author_id, authorName: names.get(tipRow.author_id) || '', agentId: tipRow.agent_id, title: tipRow.title, content: tipRow.content,
    createdAt: tipRow.created_at, acknowledgedAt: tipRow.acknowledged_at || null, seenBy: tipRow.seen_by,
  }));
}

/** quality: tips I sent. agent: tips I received. */
async function listTips(user) {
  const { rows } = await query('SELECT * FROM tips WHERE author_id = $1 OR agent_id = $1 ORDER BY created_at DESC', [user.id]);
  return formatTipsForApi(rows);
}

/** One copy per agent. Agents who are not followed by this Quality member are skipped. */
async function createTips(user, body) {
  const followedAgentIds = new Set((await visibleAgentIds(user)).filter(Boolean));
  const ids = uniqueNonEmpty(body.agentIds);
  const followedRequestedIds = ids.filter((agentId) => followedAgentIds.has(agentId));
  const skipped = ids.filter((agentId) => !followedAgentIds.has(agentId));
  if (!followedRequestedIds.length) throw Errors.validation([{ field: 'agentIds', message: 'None of these agents is followed by you' }]);
  return runInTransaction(async (dbClient) => {
    const rows = [];
    for (const agentId of followedRequestedIds) {
      rows.push((await dbClient.query(`INSERT INTO tips (author_id, agent_id, title, content) VALUES ($1,$2,$3,$4) RETURNING *`, [user.id, agentId, body.title, body.content])).rows[0]);
    }
    await notifyUsers(dbClient, followedRequestedIds, { type: 'tip', title: body.title, message: body.content.slice(0, 140) }, user.id);
    return { created: await formatTipsForApi(rows), skipped };
  });
}

/** The agents I follow, grouped by team */
async function listFollowedAgentsGroupedByTeam(user) {
  const agents = await findUsers(`u.role = 'agent' AND u.active AND u.quality_id = $1`, [user.id]);
  const { rows: teams } = await query('SELECT t.*, COALESCE(array_agg(a.id) FILTER (WHERE a.id IS NOT NULL), \'{}\') agent_ids FROM teams t LEFT JOIN users a ON a.team_id = t.id AND a.role = \'agent\' AND a.active GROUP BY t.id ORDER BY t.name');
  return teams
    .map((team) => ({
      team: { id: team.id, name: team.name, leaderId: team.leader_id, agentIds: team.agent_ids, managerId: team.manager_id || '' },
      agents: agents.filter((agent) => agent.team_id === team.id).map(formatUserForApi),
    }))
    .filter((group) => group.agents.length);
}

async function markTipsAsSeen(user) {
  await query(`UPDATE tips SET seen_by = array_append(seen_by, $1) WHERE agent_id = $1 AND NOT ($1 = ANY(seen_by))`, [user.id]);
}

async function acknowledgeTip(user, id) {
  const { rows: [tip] } = await query('SELECT * FROM tips WHERE id = $1', [id]);
  if (!tip) throw Errors.notFound('Tip');
  if (tip.agent_id !== user.id) throw Errors.notOwner('This tip is not yours');
  const { rows: [updatedTip] } = await query(
    `UPDATE tips SET acknowledged_at = COALESCE(acknowledged_at, now()), seen_by = CASE WHEN $2 = ANY(seen_by) THEN seen_by ELSE array_append(seen_by, $2) END WHERE id = $1 RETURNING *`,
    [id, user.id]);
  return (await formatTipsForApi([updatedTip]))[0];
}

module.exports = { listTips, createTips, listFollowedAgentsGroupedByTeam, markTipsAsSeen, acknowledgeTip };
