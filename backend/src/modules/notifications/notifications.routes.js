const router = require('express').Router();
const { query } = require('../../config/db');
const { z, booleanString } = require('../../utils/schemas');
const { Errors } = require('../../utils/errors');
const { readPagination } = require('../../utils/helpers');
const { validateRequest } = require('../../middleware/validate');
const { getBadges } = require('./badges');

const formatNotificationForApi = (notificationRow) => {
  const notificationData = { id: notificationRow.id, type: notificationRow.type, title: notificationRow.title, message: notificationRow.message, timestamp: notificationRow.timestamp, read: notificationRow.read };
  if (notificationRow.lead_id) notificationData.leadId = notificationRow.lead_id;
  if (notificationRow.meeting_id) notificationData.meetingId = notificationRow.meeting_id;
  return notificationData;
};

router.get('/notifications',
  validateRequest({ query: z.object({ unread: booleanString.optional(), page: z.coerce.number().int().min(1).optional(), pageSize: z.coerce.number().int().min(1).max(100).optional() }) }),
  async (req, res) => {
    const { page, pageSize, offset } = readPagination(req.valid.query, 30, 100);
    const unreadOnlyClause = req.valid.query.unread ? 'AND NOT read' : '';
    const [notificationsResult, totalResult, unreadResult] = await Promise.all([
      query(`SELECT * FROM notifications WHERE user_id = $1 ${unreadOnlyClause} ORDER BY timestamp DESC LIMIT ${pageSize} OFFSET ${offset}`, [req.user.id]),
      query(`SELECT count(*) n FROM notifications WHERE user_id = $1 ${unreadOnlyClause}`, [req.user.id]),
      query('SELECT count(*) n FROM notifications WHERE user_id = $1 AND NOT read', [req.user.id]),
    ]);
    res.json({ items: notificationsResult.rows.map(formatNotificationForApi), unreadCount: unreadResult.rows[0].n, total: totalResult.rows[0].n, page, pageSize });
  });

router.post('/notifications/read-all', async (req, res) => {
  await query('UPDATE notifications SET read = true WHERE user_id = $1 AND NOT read', [req.user.id]);
  res.status(204).end();
});

router.post('/notifications/:id/read', async (req, res) => {
  const { rows: [updatedNotification] } = await query('UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING *', [req.params.id, req.user.id]);
  if (!updatedNotification) throw Errors.notFound('Notification');
  res.json(formatNotificationForApi(updatedNotification));
});

router.get('/me/badges', async (req, res) => res.json(await getBadges(req.user.id)));

module.exports = router;
