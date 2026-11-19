const { query, runInTransaction } = require('../../config/db');
const env = require('../../config/env');
const { getCairoToday } = require('../../utils/time');
const { addLeadHistoryEntry } = require('../../utils/history');
const { getLeadSummaries, getWorkflowTouchPoints } = require('../leads/leadQueries');
const { buildTouchPoints, findCurrentTouchPoint, daysUntilExpiry, cooldownDaysLeft } = require('../leads/leadLogic');

/**
 * What would happen to this lead if agent `me` took it?
 *  ready | mine | taken | recently_worked | not_found
 */
function classifyLeadForTaking(lead, currentAgentId, today) {
  if (!lead) return { status: 'not_found' };
  if (!lead.removed_from_queue) {
    return lead.agent_id === currentAgentId
      ? { status: 'mine', leadId: lead.id, companyName: lead.company_name }
      : { status: 'taken', leadId: lead.id, companyName: lead.company_name, holderName: lead.holder_name, daysLeft: daysUntilExpiry(lead.last_activity_at, today) };
  }
  // free in the pool - but after a lead leaves an agent's queue, other agents wait 15 days before taking it
  if (lead.agent_id && lead.agent_id !== currentAgentId) {
    const cooldownDaysRemaining = cooldownDaysLeft(lead, today);
    if (cooldownDaysRemaining > 0) return { status: 'recently_worked', leadId: lead.id, companyName: lead.company_name, holderName: lead.holder_name, daysLeft: cooldownDaysRemaining };
  }
  return { status: 'ready', leadId: lead.id, companyName: lead.company_name };
}

/** Typed ids (one per line, or comma separated) -> a status for each */
async function previewLeadsByCodes(user, text) {
  const today = getCairoToday();
  const tokens = [];
  text.split(/\r?\n/).forEach((line, lineIndex) => line.split(/[\s,;]+/).filter(Boolean).forEach((code) => tokens.push({ line: lineIndex + 1, code })));

  const validCodes = tokens.filter((token) => /^[A-Za-z0-9]{1,40}$/.test(token.code)).map((token) => token.code.toLowerCase());
  const { rows } = await query(
    `SELECT l.*, u.name AS holder_name FROM leads l LEFT JOIN users u ON u.id = l.agent_id WHERE lower(l.lead_code) = ANY($1::text[])`, [validCodes]);
  const leadsByCode = new Map(rows.map((leadRow) => [leadRow.lead_code.toLowerCase(), leadRow]));

  const seen = new Set();
  let counted = 0;
  const results = tokens.map((token) => {
    const key = token.code.toLowerCase();
    if (!/^[A-Za-z0-9]{1,40}$/.test(token.code)) return { line: token.line, code: token.code, status: 'invalid' };
    if (seen.has(key)) return { line: token.line, code: token.code, status: 'duplicate' };
    seen.add(key);
    if (++counted > env.poolTakeLimit) return { line: token.line, code: token.code, status: 'over_limit' };
    return { line: token.line, code: token.code, ...classifyLeadForTaking(leadsByCode.get(key), user.id, today) };
  });
  const summary = {};
  for (const result of results) summary[result.status] = (summary[result.status] || 0) + 1;
  return { results, summary };
}

/** Take leads. Row locks: two agents can never take the same lead. */
async function takeLeadsFromPool(user, leadIds) {
  const today = getCairoToday();
  return runInTransaction(async (dbClient) => {
    const uniqueLeadIds = [...new Set(leadIds)];
    const { rows } = await dbClient.query(
      `SELECT l.*, u.name AS holder_name FROM leads l LEFT JOIN users u ON u.id = l.agent_id
       WHERE l.id = ANY($1::uuid[]) ORDER BY l.id FOR UPDATE OF l`, [uniqueLeadIds]);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const steps = await getWorkflowTouchPoints(dbClient, [...new Set(rows.map((row) => row.campaign_code))]);

    const takenIds = [];
    const skipped = [];
    for (const id of uniqueLeadIds) {
      if (takenIds.length >= env.poolTakeLimit) { skipped.push({ id, reason: 'over_limit' }); continue; }
      const lead = byId.get(id);
      const classification = classifyLeadForTaking(lead, user.id, today);
      if (classification.status !== 'ready') { skipped.push({ id, reason: classification.status }); continue; }

      const touchPoints = buildTouchPoints(steps.get(lead.campaign_code) || [], new Date());
      const { current: currentTouchPointOrder, nextDue } = findCurrentTouchPoint(touchPoints);
      await dbClient.query(
        `UPDATE leads SET agent_id = $2, round = round + 1, assigned_at = now(), touch_points = $3, current_touch_point = $4,
                next_due_at = $5, status = 'new', discovery_reached = false, stopped = false, removed_from_queue = false,
                removed_at = NULL, expired_at = NULL, last_activity_at = now() WHERE id = $1`,
        [id, user.id, JSON.stringify(touchPoints), currentTouchPointOrder, nextDue]);
      await addLeadHistoryEntry(dbClient, id, 'taken', { id: user.id, name: user.name }, { round: lead.round + 1, agentId: user.id, detail: 'Taken from the pool' });
      takenIds.push(id);
    }
    return { taken: await getLeadSummaries(dbClient, takenIds), skipped };
  });
}

module.exports = { previewLeadsByCodes, takeLeadsFromPool };
