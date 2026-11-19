const { pool } = require('../../config/db');
const { getUserNamesById } = require('../../utils/user');

function formatMeetingForApi(meetingRow, userNamesById) {
  const meetingData = { id: meetingRow.id, type: meetingRow.type };
  if (meetingRow.lead_id) meetingData.leadId = meetingRow.lead_id;
  if (meetingRow.lead_name) meetingData.leadName = meetingRow.lead_name;
  if (meetingRow.company_name) meetingData.companyName = meetingRow.company_name;
  if (meetingRow.agent_id) meetingData.agentId = meetingRow.agent_id;
  meetingData.participantIds = meetingRow.participant_ids || [];
  meetingData.participantNames = meetingData.participantIds.map((personId) => userNamesById.get(personId) || '');
  meetingData.title = meetingRow.title;
  meetingData.date = meetingRow.date;
  meetingData.time = meetingRow.time;
  meetingData.duration = meetingRow.duration;
  meetingData.notes = meetingRow.notes || '';
  if (meetingRow.outcome) meetingData.outcome = meetingRow.outcome;
  meetingData.status = meetingRow.status;
  meetingData.priority = meetingRow.priority;
  meetingData.createdBy = meetingRow.created_by;
  meetingData.createdByName = userNamesById.get(meetingRow.created_by) || '';
  if (meetingRow.reminder_sent_at) meetingData.reminderSentAt = meetingRow.reminder_sent_at;
  return meetingData;
}

/** meeting rows -> API meetings (one query for all the names) */
async function formatMeetingsWithNames(rows, db = pool) {
  const userNamesById = await getUserNamesById(rows.flatMap((meetingRow) => [...(meetingRow.participant_ids || []), meetingRow.created_by]), db);
  return rows.map((meetingRow) => formatMeetingForApi(meetingRow, userNamesById));
}

module.exports = { formatMeetingForApi, formatMeetingsWithNames };
