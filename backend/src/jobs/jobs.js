/**
 * The timer jobs (run every 30 seconds inside one transaction, guarded by an advisory lock
 * so two server instances never run them twice):
 *  1. 15-day rule        - no progress for 15 days -> the lead goes back to the pool
 *  2. finished workflow  - every step done/skipped -> the lead goes back to the pool
 *  3. meeting reminders  - 15 minutes before a meeting
 *  4. clean up old idempotency keys and expired refresh tokens
 * A recorded sale does NOT keep a lead in the queue (the sale stays with the agent who made it).
 * Only an upcoming arranged meeting keeps a lead alive until the meeting is over.
 * (The automatic e-mail job is not part of this back end.)
 */
const env = require('../config/env');
const { runInTransaction } = require('../config/db');
const { SYSTEM_ACTOR } = require('../utils/history');
const { notifyUsers } = require('../utils/notify');
const { releaseLeadToPool } = require('../modules/leads/leadQueries');

const TODAY_SQL = `(now() AT TIME ZONE '${env.tz}')::date`;
// an arranged meeting today or later keeps the lead alive
const NO_UPCOMING_MEETING_SQL = `NOT EXISTS (SELECT 1 FROM meetings m WHERE m.lead_id = l.id AND m.status = 'arranged' AND m.date >= ${TODAY_SQL})`;

async function releaseLeadsToPool(dbClient, rows, action, detail, tellAgent) {
  for (const lead of rows) {
    await releaseLeadToPool(dbClient, lead, SYSTEM_ACTOR, action, detail);
    if (tellAgent) {
      await notifyUsers(dbClient, [lead.agent_id], { type: 'overdue', title: 'Lead returned to the pool', message: `${lead.company_name} (${lead.lead_code}): ${detail}`, leadId: lead.id });
    }
  }
  return rows.length;
}

async function expireLeads(dbClient) {
  // a meeting held in the last 15 days counts as activity
  const { rows } = await dbClient.query(
    `SELECT l.* FROM leads l
     WHERE NOT l.removed_from_queue AND l.agent_id IS NOT NULL
       AND (${TODAY_SQL} - (l.last_activity_at AT TIME ZONE '${env.tz}')::date) >= $1
       AND ${NO_UPCOMING_MEETING_SQL}
       AND NOT EXISTS (SELECT 1 FROM meetings m WHERE m.lead_id = l.id AND m.status IN ('arranged','completed','no_show') AND (${TODAY_SQL} - m.date) < $1)
     FOR UPDATE OF l SKIP LOCKED`, [env.expiryDays]);
  return releaseLeadsToPool(dbClient, rows, 'expired_15_days', `No progress for ${env.expiryDays} days`, true);
}

async function finishWorkflows(dbClient) {
  const { rows } = await dbClient.query(
    `SELECT l.* FROM leads l
     WHERE NOT l.removed_from_queue AND l.agent_id IS NOT NULL AND l.current_touch_point = -1 AND jsonb_array_length(l.touch_points) > 0
       AND ${NO_UPCOMING_MEETING_SQL}
     FOR UPDATE OF l SKIP LOCKED`);
  return releaseLeadsToPool(dbClient, rows, 'workflow_finished', 'Every step of the workflow is done', false);
}

async function sendMeetingReminders(dbClient) {
  const { rows } = await dbClient.query(
    `SELECT * FROM meetings WHERE status = 'arranged' AND reminder_sent_at IS NULL
       AND ((date + time::time) AT TIME ZONE '${env.tz}') BETWEEN now() AND now() + interval '15 minutes'
     FOR UPDATE SKIP LOCKED`);
  for (const meeting of rows) {
    await notifyUsers(dbClient, [...meeting.participant_ids, meeting.created_by], { type: 'meeting', title: 'Meeting in 15 minutes', message: `${meeting.title} at ${meeting.time}`, leadId: meeting.lead_id, meetingId: meeting.id });
    await dbClient.query('UPDATE meetings SET reminder_sent_at = now() WHERE id = $1', [meeting.id]);
  }
  return rows.length;
}

async function cleanUpOldRecords(dbClient) {
  await dbClient.query(`DELETE FROM idempotency_keys WHERE created_at < now() - interval '24 hours'`);
  await dbClient.query('DELETE FROM refresh_tokens WHERE expires_at < now()');
}

let runCounter = 0;
/** one run of every job; returns what it did (used by the timer and by tests) */
async function runOnce() {
  return runInTransaction(async (dbClient) => {
    const { rows: [lock] } = await dbClient.query('SELECT pg_try_advisory_xact_lock(727001) AS ok');
    if (!lock.ok) return null; // another instance is running them
    const out = { expired: await expireLeads(dbClient), finished: await finishWorkflows(dbClient), reminders: await sendMeetingReminders(dbClient) };
    if (runCounter++ % 120 === 0) await cleanUpOldRecords(dbClient); // about once an hour
    return out;
  });
}

module.exports = { runOnce };
