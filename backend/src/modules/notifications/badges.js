const { pool } = require('../../config/db');

/** The numbers next to the menu items. */
async function getBadges(userId, db = pool) {
  const { rows: [counts] } = await db.query(
    `SELECT
       (SELECT count(*) FROM team_updates WHERE $1 = ANY(recipient_ids) AND NOT ($1 = ANY(seen_by))) AS updates,
       (SELECT count(*) FROM tasks        WHERE $1 = ANY(assigned_to)   AND NOT ($1 = ANY(seen_by))) AS tasks,
       (SELECT count(*) FROM tips         WHERE agent_id = $1           AND NOT ($1 = ANY(seen_by))) AS tips,
       (SELECT count(*) FROM escalations  WHERE handler_id = $1 AND status = 'open')                  AS escalations`,
    [userId]
  );
  return { updates: counts.updates, tasks: counts.tasks, tips: counts.tips, escalations: counts.escalations };
}
module.exports = { getBadges };
