const { query } = require('../../config/db');
const env = require('../../config/env');
const { getCairoToday, getFirstDayOfMonth } = require('../../utils/time');
const { findUsers, formatUserForApi } = require('../../utils/user');
const { formatMeetingsWithNames } = require('../meetings/meeting.dto');
const { LEAD_SELECT } = require('../leads/leadQueries');
const { formatLeadSummaryForApi } = require('../leads/leadLogic');
const { getTeam } = require('../teams/teams.service');

const emptyCallCounts = () => ({ nvm: 0, lvm: 0, discovery: 0, total: 0 });

/** today's calls (Cairo day) per agent: Map(agentId -> {nvm,lvm,discovery,total}) */
async function countCallsTodayPerAgent(agentIds, today) {
  const { rows } = await query(
    `SELECT agent_id, type, count(*) n FROM call_logs WHERE agent_id = ANY($1::uuid[]) AND (timestamp AT TIME ZONE $3)::date = $2::date GROUP BY 1, 2`,
    [agentIds, today, env.tz]);
  const callsByAgent = new Map();
  for (const row of rows) {
    if (!callsByAgent.has(row.agent_id)) callsByAgent.set(row.agent_id, emptyCallCounts());
    const agentCalls = callsByAgent.get(row.agent_id);
    agentCalls[row.type] = row.n; agentCalls.total += row.n;
  }
  return callsByAgent;
}
const sumCallCounts = (list) => list.reduce((total, callCounts) => ({ nvm: total.nvm + callCounts.nvm, lvm: total.lvm + callCounts.lvm, discovery: total.discovery + callCounts.discovery, total: total.total + callCounts.total }), emptyCallCounts());

/** arranged meetings of today that involve any of these people */
async function findMeetingsToday(personIds, today) {
  const { rows } = await query(
    `SELECT * FROM meetings WHERE status = 'arranged' AND date = $2::date
       AND (created_by = ANY($1::uuid[]) OR agent_id = ANY($1::uuid[]) OR participant_ids && $1::uuid[]) ORDER BY time`, [personIds, today]);
  return rows;
}
const countMeetingsInvolvingPerson = (rows, id) => rows.filter((meeting) => meeting.created_by === id || meeting.agent_id === id || (meeting.participant_ids || []).includes(id)).length;

async function buildAgentDashboard(user) {
  const today = getCairoToday();
  const calls = (await countCallsTodayPerAgent([user.id], today)).get(user.id) || emptyCallCounts();
  const sales = (await query(`SELECT count(*) n FROM sales WHERE agent_id = $1 AND date >= $2::date`, [user.id, getFirstDayOfMonth(today)])).rows[0].n;
  return {
    role: 'agent', dailyCallTarget: user.daily_call_target, todayCalls: calls,
    emailsToday: 0, // e-mail sending is not part of this back end
    salesThisMonth: sales, meetingsToday: await formatMeetingsWithNames(await findMeetingsToday([user.id], today)),
  };
}

async function buildTeamLeaderDashboard(user) {
  const today = getCairoToday();
  const agents = await findUsers(`u.role = 'agent' AND u.active AND u.team_id = $1`, [user.team_id]);
  const calls = await countCallsTodayPerAgent(agents.map((agent) => agent.id), today);
  const meetings = await findMeetingsToday([...agents.map((agent) => agent.id), user.id], today);
  const { rows } = await query(
    `${LEAD_SELECT} WHERE l.expired_at IS NOT NULL AND l.agent_id = ANY($1::uuid[]) ORDER BY l.expired_at`, [agents.map((agent) => agent.id)]);
  return {
    role: 'team_leader', team: await getTeam(user.team_id), meetingsToday: await formatMeetingsWithNames(meetings),
    expiredLeads: rows.map((leadRow) => formatLeadSummaryForApi(leadRow, today)),
    agents: agents.map((agent) => ({ agent: formatUserForApi(agent), todayCalls: calls.get(agent.id) || emptyCallCounts(), dailyCallTarget: agent.daily_call_target, emailsToday: 0, meetingsToday: countMeetingsInvolvingPerson(meetings, agent.id) })),
  };
}

async function buildOperationManagerDashboard(user) {
  const today = getCairoToday();
  const { rows: teams } = await query('SELECT id FROM teams WHERE manager_id = $1 ORDER BY name', [user.id]);
  const leaders = await findUsers(`u.role = 'team_leader' AND u.team_id = ANY($1::uuid[])`, [teams.map((team) => team.id)]);
  const agents = await findUsers(`u.role = 'agent' AND u.active AND u.team_id = ANY($1::uuid[])`, [teams.map((t) => t.id)]);
  const calls = await countCallsTodayPerAgent(agents.map((agent) => agent.id), today);
  const meetings = await findMeetingsToday([...agents.map((agent) => agent.id), ...leaders.map((leader) => leader.id), user.id], today);
  const teamSummaries = [];
  for (const team of teams) {
    const agentsInTeam = agents.filter((agent) => agent.team_id === team.id);
    const leader = leaders.find((leaderUser) => leaderUser.team_id === team.id);
    teamSummaries.push({
      team: await getTeam(team.id), leader: formatUserForApi(leader),
      todayCalls: sumCallCounts(agentsInTeam.map((agent) => calls.get(agent.id) || emptyCallCounts())),
      teamTarget: agentsInTeam.reduce((targetTotal, agent) => targetTotal + agent.daily_call_target, 0), emailsToday: 0,
      meetingsToday: new Set(agentsInTeam.flatMap((agent) => meetings.filter((meeting) => countMeetingsInvolvingPerson([meeting], agent.id)).map((meeting) => meeting.id))).size,
      agents: agentsInTeam.map((agent) => ({ agent: formatUserForApi(agent), calls: calls.get(agent.id) || emptyCallCounts(), target: agent.daily_call_target })),
    });
  }
  return { role: 'operation_manager', meetingsToday: await formatMeetingsWithNames(meetings), teams: teamSummaries };
}

module.exports = { agent: buildAgentDashboard, team_leader: buildTeamLeaderDashboard, operation_manager: buildOperationManagerDashboard };
