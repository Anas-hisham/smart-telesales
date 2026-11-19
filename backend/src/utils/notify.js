const { pool } = require('../config/db');
const { uniqueNonEmpty } = require('./helpers');

/**
 * Put one notification row for each person. Nobody is told about what he did himself,
 * and a disabled user is never notified.
 * payload: { type, title, message, leadId?, meetingId? }
 */
async function notifyUsers(db, userIds, payload, actorId = null) {
  const ids = uniqueNonEmpty(userIds).filter((id) => id !== actorId);
  if (!ids.length) return;
  await (db || pool).query(
    `INSERT INTO notifications (user_id, type, title, message, lead_id, meeting_id)
     SELECT u.id, $2, $3, $4, $5, $6 FROM users u WHERE u.id = ANY($1::uuid[]) AND u.active`,
    [ids, payload.type || 'update', payload.title, payload.message, payload.leadId || null, payload.meetingId || null]
  );
}

module.exports = { notifyUsers };
