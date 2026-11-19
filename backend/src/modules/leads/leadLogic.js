/**
 * Pure lead rules (no database): touch points, buckets, DTO.
 * A lead keeps its touch points as JSON: [{order,type,label,dayOffset,status,completedAt,dueDate,skippedAt}]
 * stored status: pending | completed | skipped.   "overdue" is computed when the lead is sent out.
 */
const env = require('../../config/env');
const { getCairoToday, toCairoDate, daysBetween, addDaysToTimestamp } = require('../../utils/time');

/** campaign steps -> the steps of one lead, with their due dates */
function buildTouchPoints(workflowTouchPoints, assignedAt) {
  const baseIso = new Date(assignedAt).toISOString();
  return workflowTouchPoints.map((touchPoint) => ({
    order: touchPoint.order, type: touchPoint.type, label: touchPoint.label, dayOffset: touchPoint.dayOffset,
    status: 'pending', completedAt: null, dueDate: addDaysToTimestamp(baseIso, touchPoint.dayOffset), skippedAt: null,
  }));
}

/** the first pending step is the current one (-1 = nothing left) */
function findCurrentTouchPoint(touchPoints) {
  const currentTouchPoint = touchPoints.find((touchPoint) => touchPoint.status === 'pending');
  return { current: currentTouchPoint ? currentTouchPoint.order : -1, nextDue: currentTouchPoint ? currentTouchPoint.dueDate : null };
}

function formatTouchPointForApi(touchPoint, today, raw = false) {
  const overdue = !raw && touchPoint.status === 'pending' && toCairoDate(touchPoint.dueDate) < today;
  const touchPointData = {
    order: touchPoint.order, type: touchPoint.type, label: touchPoint.label, dayOffset: touchPoint.dayOffset,
    status: overdue ? 'overdue' : touchPoint.status, completedAt: touchPoint.completedAt || null, dueDate: touchPoint.dueDate || null,
  };
  if (touchPoint.skippedAt) touchPointData.skippedAt = touchPoint.skippedAt;
  return touchPointData;
}

function getLeadBucket(leadRow, today) {
  if (leadRow.stopped) return 'stop';
  if (leadRow.current_touch_point === -1) return 'finished';
  return toCairoDate(leadRow.next_due_at) <= today ? 'today' : 'next';
}

const QUEUE_CATEGORY_BY_STATUS = { new: 'new', discovery: 'discovery', lvm: 'lvm', nvm: 'nvm', arranged_meeting: 'discovery', no_response: 'nvm' };

/** days left of the 15-day counter */
const daysUntilExpiry = (lastActivityAt, today) => Math.max(0, env.expiryDays - daysBetween(toCairoDate(lastActivityAt), today));

/** days left before OTHER agents may take a lead that left a queue (counted from the day it left) */
const cooldownDaysLeft = (lead, today) =>
  Math.max(0, env.cooldownDays - daysBetween(toCairoDate(lead.removed_at || lead.last_activity_at), today));

/** Lead row (from LEAD_SELECT) -> "LeadSummary" */
function formatLeadSummaryForApi(leadRow, today = getCairoToday()) {
  const summary = {
    id: leadRow.id, leadCode: leadRow.lead_code, campaignCode: leadRow.campaign_code, companyName: leadRow.company_name,
    contactName: leadRow.contact_name, phone: leadRow.phone, email: leadRow.email, status: leadRow.status,
    agentId: leadRow.agent_id, agentName: leadRow.agent_name || null, assignedAt: leadRow.assigned_at,
    touchPoints: (leadRow.touch_points || []).map((touchPoint) => formatTouchPointForApi(touchPoint, today)),
    currentTouchPoint: leadRow.current_touch_point, stopped: leadRow.stopped, removedFromQueue: leadRow.removed_from_queue,
    removedAt: leadRow.removed_at || null, expiredAt: leadRow.expired_at || null, round: leadRow.round,
    lastActivityAt: leadRow.last_activity_at, discoveryReached: leadRow.discovery_reached,
    bucket: getLeadBucket(leadRow, today), queueCategory: QUEUE_CATEGORY_BY_STATUS[leadRow.status] || 'new',
    templateType: leadRow.discovery_reached ? 'discovery' : 'no_response',
    daysUntilExpiry: daysUntilExpiry(leadRow.last_activity_at, today),
    hasSale: !!leadRow.has_sale, callCount: leadRow.call_count || 0,
  };
  if (leadRow.last_call) summary.lastCall = { type: leadRow.last_call.type, description: leadRow.last_call.description, timestamp: new Date(leadRow.last_call.timestamp).toISOString() };
  return summary;
}

module.exports = { buildTouchPoints, findCurrentTouchPoint, formatTouchPointForApi, getLeadBucket, formatLeadSummaryForApi, daysUntilExpiry, cooldownDaysLeft };
