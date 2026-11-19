const { query } = require('../../config/db');
const { Errors } = require('../../utils/errors');
const { readPagination } = require('../../utils/helpers');
const { getCairoToday } = require('../../utils/time');
const { visibleAgentIds } = require('../../utils/scope');
const { formatMeetingsWithNames } = require('../meetings/meeting.dto');
const { LEAD_SELECT, bucketFilterSql } = require('./leadQueries');
const { formatLeadSummaryForApi, formatTouchPointForApi } = require('./leadLogic');

/** SQL that limits leads to the ones this person may see. Pushes its params into p. */
async function buildLeadVisibilitySql(user, sqlParams) {
  if (user.role === 'admin') return 'TRUE';
  if (user.role === 'agent') { sqlParams.push(user.id); return `l.agent_id = $${sqlParams.length}`; }
  sqlParams.push(await visibleAgentIds(user));
  return `l.agent_id = ANY($${sqlParams.length}::uuid[])`;
}

async function listLeads(user, filters) {
  const sqlParams = [];
  const addSqlParam = (value) => { sqlParams.push(value); return `$${sqlParams.length}`; };
  const where = [await buildLeadVisibilitySql(user, sqlParams)];
  const today = getCairoToday();

  if (!(filters.includeRemoved && user.role !== 'agent')) where.push('NOT l.removed_from_queue');
  if (filters.agentId) where.push(`l.agent_id = ${addSqlParam(filters.agentId)}`);
  if (filters.campaignCode) where.push(`l.campaign_code = ${addSqlParam(filters.campaignCode.toUpperCase())}`);
  if (filters.status) where.push(`l.status = ${addSqlParam(filters.status)}`);
  if (filters.bucket) where.push(`(${bucketFilterSql(filters.bucket, addSqlParam(today))})`);
  if (filters.expired !== undefined) where.push(filters.expired ? 'l.expired_at IS NOT NULL' : 'l.expired_at IS NULL');
  if (filters.q) {
    const searchPattern = addSqlParam(`%${filters.q.trim()}%`);
    where.push(`(l.lead_code ILIKE ${searchPattern} OR l.company_name ILIKE ${searchPattern} OR l.contact_name ILIKE ${searchPattern} OR l.email ILIKE ${searchPattern} OR l.phone ILIKE ${searchPattern})`);
  }
  const { page, pageSize, offset } = readPagination(filters);
  const whereClause = where.join(' AND ');

  const total = (await query(`SELECT count(*) n FROM leads l WHERE ${whereClause}`, sqlParams)).rows[0].n;
  const { rows } = await query(
    `${LEAD_SELECT} WHERE ${whereClause} ORDER BY l.next_due_at NULLS LAST, l.lead_code LIMIT ${pageSize} OFFSET ${offset}`, sqlParams);
  return { items: rows.map((leadRow) => formatLeadSummaryForApi(leadRow, today)), total, page, pageSize };
}

/** one lead with call logs, history, previous rounds and the next meeting */
async function getLeadDetails(user, id) {
  const sqlParams = [id];
  const visibilitySql = await buildLeadVisibilitySql(user, sqlParams);
  const { rows: [leadRow] } = await query(`${LEAD_SELECT} WHERE l.id = $1 AND (${visibilitySql})`, sqlParams);
  if (!leadRow) throw Errors.notFound('Lead'); // a lead you may not see looks like a lead that does not exist
  const today = getCairoToday();

  const [callLogsResult, historyResult, previousAssignmentsResult, upcomingMeetingResult] = await Promise.all([
    query(`SELECT c.*, u.name AS agent_name FROM call_logs c JOIN users u ON u.id = c.agent_id WHERE c.lead_id = $1 ORDER BY c.timestamp DESC`, [id]),
    query(`SELECT * FROM lead_history WHERE lead_id = $1 ORDER BY timestamp DESC`, [id]),
    query(`SELECT * FROM lead_assignments WHERE lead_id = $1 ORDER BY round DESC`, [id]),
    query(`SELECT * FROM meetings WHERE lead_id = $1 AND status = 'arranged' AND date >= $2::date ORDER BY date, time LIMIT 1`, [id, today]),
  ]);

  const leadDetails = formatLeadSummaryForApi(leadRow, today);
  leadDetails.callLogs = callLogsResult.rows.map(formatCallLogForApi);
  leadDetails.history = historyResult.rows.map((historyRow) => {
    const entry = { id: historyRow.id, action: historyRow.action, timestamp: historyRow.timestamp, userId: historyRow.user_id, userName: historyRow.user_name };
    if (historyRow.detail) entry.detail = historyRow.detail;
    if (historyRow.round != null) entry.round = historyRow.round;
    if (historyRow.agent_id) entry.agentId = historyRow.agent_id;
    if (historyRow.touch_point_order != null) entry.touchPointOrder = historyRow.touch_point_order;
    if (historyRow.touch_point_label) entry.touchPointLabel = historyRow.touch_point_label;
    if (historyRow.touch_point_type) entry.touchPointType = historyRow.touch_point_type;
    if (historyRow.meta) entry.meta = historyRow.meta;
    return entry;
  });
  leadDetails.previousAssignments = previousAssignmentsResult.rows.map((assignment) => ({
    round: assignment.round, agentId: assignment.agent_id, agentName: assignment.agent_name, assignedAt: assignment.assigned_at, endedAt: assignment.ended_at,
    endedBy: assignment.ended_by, endedByName: assignment.ended_by_name,
    touchPoints: (assignment.touch_points || []).map((touchPoint) => formatTouchPointForApi(touchPoint, today, true)),
  }));
  if (upcomingMeetingResult.rows[0]) leadDetails.upcomingMeeting = (await formatMeetingsWithNames(upcomingMeetingResult.rows))[0];
  return leadDetails;
}

function formatCallLogForApi(callLogRow) {
  const callLogData = { id: callLogRow.id, type: callLogRow.type };
  if (callLogRow.reason) callLogData.reason = callLogRow.reason;
  callLogData.description = callLogRow.description;
  callLogData.timestamp = callLogRow.timestamp;
  if (callLogRow.edited_at) callLogData.editedAt = callLogRow.edited_at;
  callLogData.touchPointOrder = callLogRow.touch_point_order;
  if (callLogRow.touch_point_label) callLogData.touchPointLabel = callLogRow.touch_point_label;
  callLogData.agentId = callLogRow.agent_id;
  callLogData.agentName = callLogRow.agent_name;
  callLogData.round = callLogRow.round;
  return callLogData;
}

/** campaign -> Today / Next -> step -> category, plus Stop and Finished */
async function getAgentWorkQueue(user) {
  const today = getCairoToday();
  const { rows } = await query(
    `${LEAD_SELECT} WHERE l.agent_id = $1 AND NOT l.removed_from_queue ORDER BY l.next_due_at NULLS LAST, l.lead_code`, [user.id]);
  const names = new Map((await query('SELECT campaign_code, name FROM workflows')).rows.map((workflow) => [workflow.campaign_code, workflow.name]));
  const campaigns = new Map();

  for (const leadRow of rows) {
    const lead = formatLeadSummaryForApi(leadRow, today);
    if (!campaigns.has(lead.campaignCode)) {
      campaigns.set(lead.campaignCode, { code: lead.campaignCode, name: names.get(lead.campaignCode) || lead.campaignCode, today: [], next: [], todayCount: 0, nextCount: 0, stopped: [], finished: [], total: 0 });
    }
    const campaignEntry = campaigns.get(lead.campaignCode);
    campaignEntry.total += 1;
    if (lead.bucket === 'stop') { campaignEntry.stopped.push(lead); continue; }
    if (lead.bucket === 'finished') { campaignEntry.finished.push(lead); continue; }
    const groups = lead.bucket === 'today' ? campaignEntry.today : campaignEntry.next;
    const step = lead.touchPoints.find((touchPoint) => touchPoint.order === lead.currentTouchPoint);
    let group = groups.find((existingGroup) => existingGroup.order === step.order);
    if (!group) {
      group = { order: step.order, type: step.type, label: step.label, total: 0, byCategory: { new: [], discovery: [], lvm: [], nvm: [] } };
      groups.push(group);
    }
    group.total += 1;
    group.byCategory[lead.queueCategory].push(lead);
    if (lead.bucket === 'today') campaignEntry.todayCount += 1; else campaignEntry.nextCount += 1;
  }
  for (const campaignEntry of campaigns.values()) { campaignEntry.today.sort((groupA, groupB) => groupA.order - groupB.order); campaignEntry.next.sort((groupA, groupB) => groupA.order - groupB.order); }

  const { rows: meetings } = await query(
    `SELECT * FROM meetings WHERE status = 'arranged' AND date = $2::date
       AND (created_by = $1 OR agent_id = $1 OR $1 = ANY(participant_ids)) ORDER BY time`, [user.id, today]);
  return { campaigns: [...campaigns.values()], arrangedMeetingsToday: await formatMeetingsWithNames(meetings) };
}

module.exports = { listLeads, getLeadDetails, getAgentWorkQueue, formatCallLogForApi };
