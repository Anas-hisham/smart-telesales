const { runInTransaction } = require('../../config/db');
const { Errors } = require('../../utils/errors');
const { addLeadHistoryEntry, SYSTEM_ACTOR } = require('../../utils/history');
const { notifyUsers } = require('../../utils/notify');
const { findUser } = require('../../utils/user');
const { getLeadSummary, archiveCurrentRound, getWorkflowTouchPoints, releaseLeadToPool, hasUpcomingMeeting } = require('./leadQueries');
const { buildTouchPoints, findCurrentTouchPoint } = require('./leadLogic');
const { formatCallLogForApi } = require('./leads.service');

const toActor = (user) => ({ id: user.id, name: user.name });
const touchPointInfo = (touchPoint) => ({ order: touchPoint.order, label: touchPoint.label, type: touchPoint.type });

/** Lock the lead and check it is in MY queue (and, by default, can still be worked). */
async function lockLeadOwnedByAgent(dbClient, id, user, { workable = true } = {}) {
  const { rows: [lead] } = await dbClient.query('SELECT * FROM leads WHERE id = $1 FOR UPDATE', [id]);
  if (!lead) throw Errors.notFound('Lead');
  if (lead.agent_id !== user.id) throw Errors.notOwner('This lead is not in your queue');
  if (lead.removed_from_queue) throw Errors.conflict('LEAD_NOT_WORKABLE', 'This lead is not in your queue any more');
  if (workable && lead.stopped) throw Errors.conflict('LEAD_NOT_WORKABLE', 'The workflow of this lead is stopped');
  if (workable && lead.expired_at) throw Errors.conflict('LEAD_NOT_WORKABLE', 'This lead expired and waits for its Team Leader');
  return lead;
}

function findTouchPointByOrder(lead, order) {
  const touchPoint = lead.touch_points.find((candidate) => candidate.order === order);
  if (!touchPoint) throw Errors.notFound('Touch point');
  return touchPoint;
}

/** write the steps back, refresh "current step / next due" and count it as activity */
async function saveTouchPointsOnLead(dbClient, lead, extraSql = '', extraParams = []) {
  const { current: currentTouchPointOrder, nextDue } = findCurrentTouchPoint(lead.touch_points);
  await dbClient.query(
    `UPDATE leads SET touch_points = $2, current_touch_point = $3, next_due_at = $4, last_activity_at = now() ${extraSql} WHERE id = $1`,
    [lead.id, JSON.stringify(lead.touch_points), currentTouchPointOrder, nextDue, ...extraParams]);
}

/**
 * The last step was just completed/skipped -> the lead leaves the queue at once (no waiting for the timer job).
 * Exception: an arranged meeting that is still to come keeps the lead until the meeting is done.
 */
async function releaseLeadIfWorkflowFinished(dbClient, lead) {
  if (!lead.touch_points.length || findCurrentTouchPoint(lead.touch_points).current !== -1) return false;
  if (await hasUpcomingMeeting(dbClient, lead.id)) return false;
  await releaseLeadToPool(dbClient, lead, SYSTEM_ACTOR, 'workflow_finished', 'Every step of the workflow is done');
  return true;
}

// ─────────── touch points ───────────
async function changeTouchPointStatus(user, leadId, order, kind) {
  return runInTransaction(async (dbClient) => {
    const lead = await lockLeadOwnedByAgent(dbClient, leadId, user);
    const touchPoint = findTouchPointByOrder(lead, order);
    const requiredStatus = kind === 'restore' ? 'skipped' : 'pending';
    if (touchPoint.status !== requiredStatus) throw Errors.conflict('TOUCHPOINT_NOT_OPEN', `This step is ${touchPoint.status}, so it cannot be ${kind === 'restore' ? 'restored' : kind + 'd'}`);
    const now = new Date().toISOString();
    if (kind === 'complete') { touchPoint.status = 'completed'; touchPoint.completedAt = now; }
    if (kind === 'skip') { touchPoint.status = 'skipped'; touchPoint.skippedAt = now; }
    if (kind === 'restore') { touchPoint.status = 'pending'; touchPoint.skippedAt = null; }
    await saveTouchPointsOnLead(dbClient, lead);
    await addLeadHistoryEntry(dbClient, lead.id, { complete: 'touch_point_completed', skip: 'touch_point_skipped', restore: 'touch_point_restored' }[kind],
      toActor(user), { round: lead.round, agentId: user.id, tp: touchPointInfo(touchPoint), detail: touchPoint.label });
    if (kind !== 'restore') await releaseLeadIfWorkflowFinished(dbClient, lead);
    return getLeadSummary(dbClient, lead.id);
  });
}

// ─────────── calls ───────────
async function logCall(user, leadId, body) {
  return runInTransaction(async (dbClient) => {
    const lead = await lockLeadOwnedByAgent(dbClient, leadId, user);
    const touchPoint = findTouchPointByOrder(lead, body.touchPointOrder);
    if (body.completeTouchPoint && touchPoint.status !== 'pending') throw Errors.conflict('TOUCHPOINT_NOT_OPEN', `This step is ${touchPoint.status}`);

    const { rows: [callLog] } = await dbClient.query(
      `INSERT INTO call_logs (lead_id, agent_id, type, reason, description, touch_point_order, touch_point_label, round)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [lead.id, user.id, body.type, body.reason || null, body.description, touchPoint.order, touchPoint.label, lead.round]);

    if (body.completeTouchPoint) { touchPoint.status = 'completed'; touchPoint.completedAt = new Date().toISOString(); }
    await saveTouchPointsOnLead(dbClient, lead, ', status = $5, discovery_reached = $6', [body.type, lead.discovery_reached || body.type === 'discovery']);
    await addLeadHistoryEntry(dbClient, lead.id, 'call_logged', toActor(user), {
      round: lead.round, agentId: user.id, tp: touchPointInfo(touchPoint), detail: `${body.type.toUpperCase()}: ${body.description}`.slice(0, 500),
      meta: { callLogId: callLog.id, completedStep: !!body.completeTouchPoint },
    });
    if (body.completeTouchPoint) await releaseLeadIfWorkflowFinished(dbClient, lead);
    return { lead: await getLeadSummary(dbClient, lead.id), callLog: formatCallLogForApi({ ...callLog, agent_name: user.name }) };
  });
}

async function editCall(user, leadId, logId, body) {
  return runInTransaction(async (dbClient) => {
    const lead = await lockLeadOwnedByAgent(dbClient, leadId, user, { workable: false });
    const { rows: [callLog] } = await dbClient.query('SELECT * FROM call_logs WHERE id = $1 AND lead_id = $2 FOR UPDATE', [logId, leadId]);
    if (!callLog) throw Errors.notFound('Call');
    if (callLog.agent_id !== user.id) throw Errors.notOwner('You can only edit your own calls');
    const { rows: [updatedCallLog] } = await dbClient.query(
      'UPDATE call_logs SET type = $2, description = $3, edited_at = now() WHERE id = $1 RETURNING *', [logId, body.type, body.description]);
    // the lead takes the type of its latest call of this round
    const { rows: [latestCallLog] } = await dbClient.query('SELECT id FROM call_logs WHERE lead_id = $1 AND round = $2 ORDER BY timestamp DESC LIMIT 1', [lead.id, lead.round]);
    if (latestCallLog?.id === logId) {
      await dbClient.query('UPDATE leads SET status = $2, discovery_reached = discovery_reached OR $3 WHERE id = $1', [lead.id, body.type, body.type === 'discovery']);
    }
    await addLeadHistoryEntry(dbClient, lead.id, 'call_edited', toActor(user), { round: lead.round, agentId: user.id, detail: body.description.slice(0, 500), meta: { callLogId: logId } });
    return { lead: await getLeadSummary(dbClient, lead.id), callLog: formatCallLogForApi({ ...updatedCallLog, agent_name: user.name }) };
  });
}

// ─────────── stop / resume / remove (agents never delete leads, only the admin does) ───────────
async function stopLeadWorkflow(user, leadId) {
  return runInTransaction(async (dbClient) => {
    const lead = await lockLeadOwnedByAgent(dbClient, leadId, user, { workable: false });
    if (lead.stopped) throw Errors.conflict('LEAD_NOT_WORKABLE', 'The workflow is already stopped');
    await dbClient.query('UPDATE leads SET stopped = true WHERE id = $1', [lead.id]);
    await addLeadHistoryEntry(dbClient, lead.id, 'stopped', toActor(user), { round: lead.round, agentId: user.id });
    return getLeadSummary(dbClient, lead.id);
  });
}

async function resumeLeadWorkflow(user, leadId) {
  return runInTransaction(async (dbClient) => {
    const lead = await lockLeadOwnedByAgent(dbClient, leadId, user, { workable: false });
    if (!lead.stopped) throw Errors.conflict('LEAD_NOT_WORKABLE', 'The workflow is not stopped');
    if (lead.expired_at) throw Errors.conflict('LEAD_NOT_WORKABLE', 'This lead expired and waits for its Team Leader');
    await dbClient.query('UPDATE leads SET stopped = false, last_activity_at = now() WHERE id = $1', [lead.id]);
    await addLeadHistoryEntry(dbClient, lead.id, 'resumed', toActor(user), { round: lead.round, agentId: user.id });
    return getLeadSummary(dbClient, lead.id);
  });
}

/** the lead leaves my queue and becomes free in the pool */
async function removeLeadFromQueue(user, leadId) {
  return runInTransaction(async (dbClient) => {
    const lead = await lockLeadOwnedByAgent(dbClient, leadId, user, { workable: false });
    await releaseLeadToPool(dbClient, lead, toActor(user), 'removed', 'Removed from the queue'); // a recorded sale does not block this
    return { id: lead.id };
  });
}

// ─────────── transfer (team leader / operation manager) ───────────
async function transferLeadToAgent(user, leadId, newAgentId) {
  return runInTransaction(async (dbClient) => {
    const { rows: [lead] } = await dbClient.query('SELECT * FROM leads WHERE id = $1 FOR UPDATE', [leadId]);
    if (!lead) throw Errors.notFound('Lead');
    if (!lead.agent_id) throw Errors.conflict('LEAD_NOT_WORKABLE', 'This lead is free in the pool');
    const currentAgent = await findUser(lead.agent_id, dbClient);
    if (!(await userManagesAgent(dbClient, user, currentAgent))) throw Errors.notOwner('This lead is not in your people');
    if (lead.removed_from_queue) throw Errors.conflict('LEAD_NOT_WORKABLE', 'This lead is free in the pool, it has nobody to transfer from');

    const newAgent = await findUser(newAgentId, dbClient);
    if (!newAgent || newAgent.role !== 'agent' || !newAgent.active || !(await userManagesAgent(dbClient, user, newAgent))) {
      throw Errors.validation([{ field: 'newAgentId', message: 'Not an active agent of yours' }]);
    }
    if (newAgent.id === lead.agent_id) throw Errors.validation([{ field: 'newAgentId', message: 'The lead is already with this agent' }]);

    await archiveCurrentRound(dbClient, lead, toActor(user));
    const workflowTouchPoints = (await getWorkflowTouchPoints(dbClient, [lead.campaign_code])).get(lead.campaign_code) || [];
    const touchPoints = buildTouchPoints(workflowTouchPoints, new Date());
    const { current: currentTouchPointOrder, nextDue } = findCurrentTouchPoint(touchPoints);
    await dbClient.query(
      `UPDATE leads SET agent_id = $2, round = round + 1, assigned_at = now(), touch_points = $3, current_touch_point = $4,
              next_due_at = $5, status = 'new', discovery_reached = false, stopped = false, removed_from_queue = false,
              removed_at = NULL, expired_at = NULL, last_activity_at = now() WHERE id = $1`,
      [lead.id, newAgent.id, JSON.stringify(touchPoints), currentTouchPointOrder, nextDue]);
    await addLeadHistoryEntry(dbClient, lead.id, 'transferred', toActor(user), {
      round: lead.round + 1, agentId: newAgent.id, detail: `From ${currentAgent.name} to ${newAgent.name}`,
    });
    await notifyUsers(dbClient, [newAgent.id], { type: 'update', title: 'A lead was given to you', message: `${lead.company_name} (${lead.lead_code}) is now in your queue`, leadId: lead.id }, user.id);
    return getLeadSummary(dbClient, lead.id);
  });
}

/** Team leader: agents of his team. Operation manager: agents of his teams. */
async function userManagesAgent(dbClient, user, agent) {
  if (!agent || agent.role !== 'agent') return false;
  if (user.role === 'team_leader') return !!user.team_id && agent.team_id === user.team_id;
  if (user.role === 'operation_manager') {
    return (await dbClient.query('SELECT 1 FROM teams WHERE id = $1 AND manager_id = $2', [agent.team_id, user.id])).rowCount > 0;
  }
  return false;
}

module.exports = { changeTouchPointStatus, logCall, editCall, stopLeadWorkflow, resumeLeadWorkflow, removeLeadFromQueue, transferLeadToAgent };
