const { query, runInTransaction } = require('../../config/db');
const { Errors } = require('../../utils/errors');
const { uniqueNonEmpty } = require('../../utils/helpers');
const { findUser, findUsers, formatUserForApi } = require('../../utils/user');
const { visibleAgentIds } = require('../../utils/scope');
const { notifyUsers } = require('../../utils/notify');
const { addLeadHistoryEntry } = require('../../utils/history');
const { formatMeetingsWithNames } = require('./meeting.dto');
const { getCairoToday } = require('../../utils/time');

/** People a user may invite, and the leads he may hold a meeting about. */
async function getMeetingOptions(user) {
  let leads = [];
  let people = [];
  if (user.role === 'agent') {
    leads = (await query(`SELECT id,lead_code, company_name, contact_name, agent_id FROM leads WHERE agent_id = $1 AND NOT removed_from_queue ORDER BY company_name`, [user.id])).rows;
    const ids = [];
    const { rows: [team] } = await query('SELECT leader_id FROM teams WHERE id = $1', [user.team_id]);
    if (team) ids.push(team.leader_id);
    if (user.quality_id) ids.push(user.quality_id);
    people = ids.length ? await findUsers('u.id = ANY($1::uuid[]) AND u.active', [ids]) : [];
  } else if (user.role === 'team_leader' || user.role === 'quality') {
    const agents = await visibleAgentIds(user);
    leads = (await query(`
    SELECT id, lead_code, company_name, contact_name, agent_id
    FROM leads
    WHERE agent_id = ANY($1::uuid[])
    AND NOT removed_from_queue
    ORDER BY company_name
`, [agents])).rows; people = await findUsers('u.id = ANY($1::uuid[]) AND u.active', [agents]);
  } else if (user.role === 'operation_manager') {
    people = await findUsers(
      `u.active AND ((u.role = 'team_leader' AND u.team_id IN (SELECT id FROM teams WHERE manager_id = $1)) OR (u.role = 'quality' AND u.lob = $2))`,
      [user.id, user.lob || '']);
  } else throw Errors.forbidden('Your role cannot schedule meetings');
  return {
    leads: leads.map((lead) => ({ id: lead.id, leadCode: lead.lead_code, companyName: lead.company_name, contactName: lead.contact_name, agentId: lead.agent_id })),
    participants: people.map(formatUserForApi),
  };
}

async function createMeeting(user, body) {
  if (user.role === 'admin') throw Errors.forbidden('Your role cannot schedule meetings');
  const meetingOptions = await getMeetingOptions(user);
  const allowed = new Set(meetingOptions.participants.map((person) => person.id));
  const issues = [];
  const invited = uniqueNonEmpty(body.participantIds || []);
  for (const id of invited) if (!allowed.has(id)) issues.push({ field: 'participantIds', message: `Person ${id} cannot be invited by you` });

  let lead = null;
  if (body.leadId) {
    lead = meetingOptions.leads.find((candidateLead) => candidateLead.id === body.leadId);
    if (!lead) {
      const leadExists = await query('SELECT 1 FROM leads WHERE id = $1', [body.leadId]);
      if (!leadExists.rowCount) throw Errors.notFound('Lead');
      throw Errors.notOwner('This lead is not in your people');
    }
  } else {
    if (user.role === 'agent') issues.push({ field: 'leadId', message: 'An agent schedules a meeting on one of his leads' });
    if (!body.title?.trim()) issues.push({ field: 'title', message: 'Required for an internal meeting' });
    if (!invited.length) issues.push({ field: 'participantIds', message: 'Invite at least one person' });
  }
  if (issues.length) throw Errors.validation(issues);

  return runInTransaction(async (dbClient) => {
    const participants = uniqueNonEmpty([...invited, ...(lead && lead.agentId !== user.id ? [lead.agentId] : [])]);
    const title = body.title?.trim() || `Meeting with ${lead?.contactName || 'the customer'}`;
    const { rows: [meeting] } = await dbClient.query(
      `INSERT INTO meetings (type, lead_id, lead_name, company_name, agent_id, participant_ids, title, date, time, duration, notes, priority, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [lead ? 'lead_meeting' : 'internal_meeting', lead?.id || null, lead?.contactName || null, lead?.companyName || null, lead?.agentId || null,
        participants, title, body.date, body.time, body.duration, body.notes?.trim() || '', body.priority || 'normal', user.id]);

    if (lead) {
      // the lead becomes Discovery and its 15-day counter restarts
      await dbClient.query(`UPDATE leads SET status = 'discovery', discovery_reached = true, last_activity_at = now() WHERE id = $1`, [lead.id]);
      await addLeadHistoryEntry(dbClient, lead.id, 'meeting_arranged', { id: user.id, name: user.name }, { agentId: lead.agentId, detail: `${body.date} ${body.time}`, meta: { meetingId: meeting.id } });
    }
    await notifyUsers(dbClient, participants, { type: 'meeting', title: 'New meeting', message: `${title} on ${body.date} at ${body.time}`, leadId: lead?.id, meetingId: meeting.id }, user.id);
    return (await formatMeetingsWithNames([meeting], dbClient))[0];
  });
}

async function listMeetings(user, filters) {
  const sqlParams = [user.id];
  const where = ['(m.created_by = $1 OR m.agent_id = $1 OR $1 = ANY(m.participant_ids))'];
  if (filters.from) { sqlParams.push(filters.from); where.push(`m.date >= $${sqlParams.length}::date`); }
  if (filters.to) { sqlParams.push(filters.to); where.push(`m.date <= $${sqlParams.length}::date`); }
  if (filters.status) { sqlParams.push(filters.status); where.push(`m.status = $${sqlParams.length}`); }
  if (filters.type) { sqlParams.push(filters.type); where.push(`m.type = $${sqlParams.length}`); }
  const { rows } = await query(`SELECT m.* FROM meetings m WHERE ${where.join(' AND ')} ORDER BY m.date, m.time`, sqlParams);
  return formatMeetingsWithNames(rows);
}

async function lockMeetingCreatedByUser(dbClient, user, id) {
  const { rows: [meeting] } = await dbClient.query('SELECT * FROM meetings WHERE id = $1 FOR UPDATE', [id]);
  if (!meeting) throw Errors.notFound('Meeting');
  if (meeting.created_by !== user.id) throw Errors.notOwner('Only the creator can change a meeting');
  return meeting;
}

async function updateMeeting(user, id, body) {
  return runInTransaction(async (dbClient) => {
    const existingMeeting = await lockMeetingCreatedByUser(dbClient, user, id);
    const status = body.status ?? existingMeeting.status;
    const outcome = body.outcome ?? existingMeeting.outcome;
    if (status === 'completed' && existingMeeting.type === 'lead_meeting' && !outcome?.trim()) {
      throw Errors.validation([{ field: 'outcome', message: 'Write the outcome before completing a lead meeting' }]);
    }
    const { rows: [updatedMeeting] } = await dbClient.query(
      `UPDATE meetings SET status=$2, outcome=$3, notes=COALESCE($4, notes), title=COALESCE($5, title), date=COALESCE($6, date),
              time=COALESCE($7, time), duration=COALESCE($8, duration), priority=COALESCE($9, priority),
              reminder_sent_at = CASE WHEN $6 IS NOT NULL OR $7 IS NOT NULL THEN NULL ELSE reminder_sent_at END
       WHERE id = $1 RETURNING *`,
      [id, status, outcome || null, body.notes ?? null, body.title ?? null, body.date ?? null, body.time ?? null, body.duration ?? null, body.priority ?? null]);
    if (status !== existingMeeting.status || body.date || body.time) {
      await notifyUsers(dbClient, updatedMeeting.participant_ids, {
        type: 'meeting', title: status === 'cancelled' ? 'Meeting cancelled' : 'Meeting changed',
        message: `${updatedMeeting.title} - ${updatedMeeting.date} ${updatedMeeting.time} (${updatedMeeting.status})`, leadId: updatedMeeting.lead_id, meetingId: updatedMeeting.id
      }, user.id);
    }
    return (await formatMeetingsWithNames([updatedMeeting], dbClient))[0];
  });
}

/** ONE transaction: a new meeting + the old one becomes "rescheduled" */
async function rescheduleMeeting(user, id, body) {
  return runInTransaction(async (dbClient) => {
    const currentMeeting = await lockMeetingCreatedByUser(dbClient, user, id);
    if (currentMeeting.status !== 'arranged') throw Errors.conflict('CONFLICT', `A ${currentMeeting.status} meeting cannot be rescheduled`);
    await dbClient.query(`UPDATE meetings SET status = 'rescheduled' WHERE id = $1`, [id]);
    const { rows: [rescheduledMeeting] } = await dbClient.query(
      `INSERT INTO meetings (type, lead_id, lead_name, company_name, agent_id, participant_ids, title, date, time, duration, notes, priority, created_by)
       SELECT type, lead_id, lead_name, company_name, agent_id, participant_ids, title, $2::date, $3, COALESCE($4, duration), COALESCE($5, notes), priority, created_by
       FROM meetings WHERE id = $1 RETURNING *`, [id, body.date, body.time, body.duration ?? null, body.notes ?? null]);
    if (currentMeeting.lead_id) await dbClient.query('UPDATE leads SET last_activity_at = now() WHERE id = $1', [currentMeeting.lead_id]);
    await notifyUsers(dbClient, currentMeeting.participant_ids, { type: 'meeting', title: 'Meeting rescheduled', message: `${currentMeeting.title} moved to ${body.date} at ${body.time}`, leadId: currentMeeting.lead_id, meetingId: rescheduledMeeting.id }, user.id);
    const [oldMeetingForApi, newMeetingForApi] = await formatMeetingsWithNames([{ ...currentMeeting, status: 'rescheduled' }, rescheduledMeeting], dbClient);
    return { old: oldMeetingForApi, new: newMeetingForApi };
  });
}

module.exports = { getMeetingOptions, createMeeting, listMeetings, updateMeeting, rescheduleMeeting };
