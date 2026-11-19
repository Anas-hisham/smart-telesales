const router = require('express').Router();
const { z, dateString } = require('../../utils/schemas');
const { validateRequest } = require('../../middleware/validate');
const { requireRole } = require('../../middleware/auth');
const analyticsService = require('./analytics.service');

router.get('/analytics', requireRole('agent', 'team_leader', 'operation_manager'),
  validateRequest({ query: z.object({ preset: z.enum(['today', 'week', 'month', 'custom']).default('today'), from: dateString.optional(), to: dateString.optional(), campaign: z.string().max(40).optional() }) }),
  async (req, res) => res.json(await analyticsService.buildAnalyticsReport(req.user, req.valid.query)));

module.exports = router;
