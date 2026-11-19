const { query, runInTransaction } = require('../../config/db');
const env = require('../../config/env');
const { Errors } = require('../../utils/errors');
const { getCairoToday, getFirstDayOfMonth, getMonthRange } = require('../../utils/time');
const { findUser, findUsers, formatUserForApi } = require('../../utils/user');
const { visibleAgentIds, canSeeAgent } = require('../../utils/scope');
const { addLeadHistoryEntry } = require('../../utils/history');

const SALE_TYPES = ['BP', 'PPI', 'MUA', 'ATEP', 'Activation', 'Retention', 'Transition'];
const emptyCountsBySaleType = () => Object.fromEntries(SALE_TYPES.map((saleType) => [saleType, 0]));

const formatSaleForApi = (saleRow) => ({
  id: saleRow.id, agentId: saleRow.agent_id, agentName: saleRow.agent_name, campaignCode: saleRow.campaign_code, leadId: saleRow.lead_id,
  leadName: saleRow.lead_name, saleType: saleRow.sale_type, date: saleRow.date, createdBy: saleRow.created_by, createdAt: saleRow.created_at,
});

const SALE_SELECT = `SELECT s.*, a.name AS agent_name, a.quality_id, a.team_id, l.contact_name AS lead_name, l.company_name, l.lead_code
  FROM sales s JOIN users a ON a.id = s.agent_id LEFT JOIN leads l ON l.id = s.lead_id`;

/** Quality records a sale for an agent he follows. A repeated sale gives a warning, it is not refused. */
async function recordSale(user, body) {
  return runInTransaction(async (dbClient) => {
    const agent = await findUser(body.agentId, dbClient);
    if (!agent || agent.role !== 'agent') throw Errors.notFound('Agent');
    if (agent.quality_id !== user.id) throw Errors.notOwner('You do not follow this agent');
    const { rows: [lead] } = await dbClient.query('SELECT * FROM leads WHERE id = $1 FOR UPDATE', [body.leadId]);
    if (!lead) throw Errors.notFound('Lead');
    if (lead.agent_id !== agent.id) throw Errors.validation([{ field: 'leadId', message: 'This lead does not belong to this agent' }]);

    const date = body.date || getCairoToday();
    const warnings = [];
    const existingSale = await dbClient.query('SELECT 1 FROM sales WHERE lead_id = $1 AND sale_type = $2 AND date = $3::date', [lead.id, body.saleType, date]);
    if (existingSale.rowCount) warnings.push('DUPLICATE_SALE');

    const { rows: [insertedSale] } = await dbClient.query(
      `INSERT INTO sales (agent_id, campaign_code, lead_id, sale_type, date, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [agent.id, lead.campaign_code, lead.id, body.saleType, date, user.id]);
    await addLeadHistoryEntry(dbClient, lead.id, 'sale_recorded', { id: user.id, name: user.name }, { round: lead.round, agentId: agent.id, detail: body.saleType });
    const { rows: [fullSaleRow] } = await dbClient.query(`${SALE_SELECT} WHERE s.id = $1`, [insertedSale.id]);
    return { sale: formatSaleForApi(fullSaleRow), warnings };
  });
}

async function deleteSale(user, id) {
  const { rows: [saleRow] } = await query(`${SALE_SELECT} WHERE s.id = $1`, [id]);
  if (!saleRow) throw Errors.notFound('Sale');
  if (saleRow.quality_id !== user.id) throw Errors.notOwner('This sale is not of one of your agents');
  await query('DELETE FROM sales WHERE id = $1', [id]);
}

/** Leaderboard, team totals, my scope and the month's sales */
async function getSalesOverview(user, month) {
  const selectedMonth = month || getCairoToday().slice(0, 7);
  const { from, to } = getMonthRange(selectedMonth);

  const counts = (await query(
    `SELECT agent_id, sale_type, count(*) n FROM sales WHERE date BETWEEN $1::date AND $2::date GROUP BY 1, 2`, [from, to])).rows;
  const byAgent = new Map();
  for (const countRow of counts) {
    if (!byAgent.has(countRow.agent_id)) byAgent.set(countRow.agent_id, { count: 0, byType: emptyCountsBySaleType() });
    const agentTotals = byAgent.get(countRow.agent_id);
    agentTotals.count += countRow.n; agentTotals.byType[countRow.sale_type] = countRow.n;
  }
  const calls = (await query(
    `SELECT agent_id, count(*) FILTER (WHERE type = 'discovery') discovery, count(*) FILTER (WHERE type = 'lvm') lvm FROM call_logs
     WHERE (timestamp AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date GROUP BY 1`, [from, to, env.tz])).rows;
  const callCountsByAgent = new Map(calls.map((callRow) => [callRow.agent_id, callRow]));

  const agents = await findUsers(`u.role = 'agent' AND u.active`);
  const leadersByTeamId = new Map((await findUsers(`u.role = 'team_leader'`)).map((leaderUser) => [leaderUser.team_id, leaderUser]));
  const { rows: teams } = await query('SELECT * FROM teams ORDER BY name');
  const agentStat = (agent) => ({ agent: formatUserForApi(agent), count: byAgent.get(agent.id)?.count || 0, byType: byAgent.get(agent.id)?.byType || emptyCountsBySaleType() });

  const groups = teams.map((team) => {
    const teamAgentStats = agents.filter((agent) => agent.team_id === team.id).map(agentStat).sort((statA, statB) => statB.count - statA.count);
    return {
      team: { id: team.id, name: team.name, leaderId: team.leader_id, agentIds: teamAgentStats.map((stat) => stat.agent.id), managerId: team.manager_id || '' },
      leader: formatUserForApi(leadersByTeamId.get(team.id)), total: teamAgentStats.reduce((runningTotal, stat) => runningTotal + stat.count, 0), target: teamAgentStats.length * env.salesTargetPerAgent, agents: teamAgentStats,
    };
  }).sort((groupA, groupB) => groupB.total - groupA.total);

  const topAgents = agents
    .map((agent) => ({ agent: formatUserForApi(agent), teamId: agent.team_id, sales: byAgent.get(agent.id)?.count || 0, discovery: callCountsByAgent.get(agent.id)?.discovery || 0, lvm: callCountsByAgent.get(agent.id)?.lvm || 0 }))
    .sort((topAgentA, topAgentB) => topAgentB.sales - topAgentA.sales || topAgentB.discovery - topAgentA.discovery).slice(0, 10);

  // my scope
  const ids = (await visibleAgentIds(user)) ?? agents.map((agent) => agent.id);
  const byType = emptyCountsBySaleType();
  let total = 0;
  for (const id of ids) {
    const agentStats = byAgent.get(id);
    if (!agentStats) continue;
    total += agentStats.count;
    for (const saleType of SALE_TYPES) byType[saleType] += agentStats.byType[saleType];
  }
  const { rows } = await query(`${SALE_SELECT} WHERE s.agent_id = ANY($1::uuid[]) AND s.date BETWEEN $2::date AND $3::date ORDER BY s.date DESC, s.created_at DESC`, [ids, from, to]);
  const sales = rows.map((saleRow) => ({ ...formatSaleForApi(saleRow), canDelete: user.role === 'quality' && saleRow.quality_id === user.id, canSeeDetails: true }));

  return { month: selectedMonth, groups, topAgents, scope: { agentIds: ids, total, target: ids.length * env.salesTargetPerAgent, byType }, sales };
}

/** The leads behind an agent's sales (private) */
async function getAgentSalesDetails(user, agentId, month) {
  const agent = await findUser(agentId);
  if (!agent || agent.role !== 'agent') throw Errors.notFound('Agent');
  if (!(await canSeeAgent(user, agent))) throw Errors.notOwner('You cannot see the details of this agent');
  const { from, to } = getMonthRange(month || getCairoToday().slice(0, 7));
  const { rows } = await query(`${SALE_SELECT} WHERE s.agent_id = $1 AND s.date BETWEEN $2::date AND $3::date ORDER BY s.date DESC`, [agentId, from, to]);
  return { sales: rows.map((saleRow) => ({ sale: formatSaleForApi(saleRow), lead: { id: saleRow.lead_id, companyName: saleRow.company_name, contactName: saleRow.lead_name, campaignCode: saleRow.campaign_code, leadCode: saleRow.lead_code } })) };
}

module.exports = { recordSale, deleteSale, getSalesOverview, getAgentSalesDetails, SALE_TYPES };
