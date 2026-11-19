// SQL pieces about leads that several modules need.
const { pool } = require('../../config/db');
const { getCairoToday } = require('../../utils/time');
const { formatLeadSummaryForApi } = require('./leadLogic');
const { addLeadHistoryEntry } = require('../../utils/history');

/** a lead + the name of its holder + sale flag + call counters of the current round */
const LEAD_SELECT = `
  SELECT l.*, u.name AS agent_name,
    EXISTS (SELECT 1 FROM sales s WHERE s.lead_id = l.id) AS has_sale,
    (SELECT count(*) FROM call_logs c WHERE c.lead_id = l.id AND c.round = l.round) AS call_count,
    (SELECT json_build_object('type', c.type, 'description', c.description, 'timestamp', c.timestamp)
       FROM call_logs c WHERE c.lead_id = l.id AND c.round = l.round ORDER BY c.timestamp DESC LIMIT 1) AS last_call
  FROM leads l LEFT JOIN users u ON u.id = l.agent_id`;

async function getLeadSummaries(db, ids) {
  if (!ids.length) return [];
  const { rows } = await db.query(`${LEAD_SELECT} WHERE l.id = ANY($1::uuid[])`, [ids]);
  const today = getCairoToday();
  const byId = new Map(rows.map((leadRow) => [leadRow.id, formatLeadSummaryForApi(leadRow, today)]));
  return ids.map((id) => byId.get(id)).filter(Boolean); // keep the order that was asked
}
async function getLeadSummary(db, id) {
  return (await getLeadSummaries(db, [id]))[0] || null;
}

/** SQL for the bucket filter. `today` is the placeholder of the Cairo date, e.g. "$3" */
const bucketFilterSql = (bucket, today) => ({
  stop: 'l.stopped',
  finished: 'NOT l.stopped AND l.current_touch_point = -1',
  today: `NOT l.stopped AND l.current_touch_point <> -1 AND (l.next_due_at AT TIME ZONE 'Africa/Cairo')::date <= ${today}::date`,
  next: `NOT l.stopped AND l.current_touch_point <> -1 AND (l.next_due_at AT TIME ZONE 'Africa/Cairo')::date > ${today}::date`,
}[bucket]);

/** steps of a campaign (touch points), keyed by campaign code */
async function getWorkflowTouchPoints(db, codes) {
  const { rows } = await db.query('SELECT campaign_code, touch_points FROM workflows WHERE campaign_code = ANY($1::text[])', [codes]);
  return new Map(rows.map((workflowRow) => [workflowRow.campaign_code, workflowRow.touch_points]));
}

/** a finished round goes to lead_assignments (previous rounds of the lead) */
async function archiveCurrentRound(db, lead, endedBy) {
  if (!lead.agent_id) return;
  const { rows: [agentRow] } = await db.query('SELECT name FROM users WHERE id = $1', [lead.agent_id]);
  await db.query(
    `INSERT INTO lead_assignments (lead_id, round, agent_id, agent_name, assigned_at, ended_by, ended_by_name, touch_points)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [lead.id, lead.round, lead.agent_id, agentRow?.name || '', lead.assigned_at, endedBy.id, endedBy.name, JSON.stringify(lead.touch_points || [])]
  );
}

/** the lead leaves its agent's queue and becomes free in the pool (a recorded sale does NOT stop this) */
async function releaseLeadToPool(db, lead, releasedBy, action, detail) {
  await archiveCurrentRound(db, lead, releasedBy);
  await db.query(`UPDATE leads SET removed_from_queue = true, stopped = true, removed_at = now() WHERE id = $1`, [lead.id]);
  await addLeadHistoryEntry(db, lead.id, action, releasedBy, { round: lead.round, agentId: lead.agent_id, detail });
}

/** an arranged meeting today or later keeps the lead in the queue */
async function hasUpcomingMeeting(db, leadId) {
  const { rowCount } = await db.query(
    `SELECT 1 FROM meetings WHERE lead_id = $1 AND status = 'arranged' AND date >= $2::date LIMIT 1`, [leadId, getCairoToday()]);
  return rowCount > 0;
}

module.exports = { releaseLeadToPool, hasUpcomingMeeting, LEAD_SELECT, getLeadSummaries, getLeadSummary, bucketFilterSql, getWorkflowTouchPoints, archiveCurrentRound, pool };
