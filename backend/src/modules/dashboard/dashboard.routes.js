const router = require('express').Router();
const { requireRole } = require('../../middleware/auth');
const dashboardService = require('./dashboard.service');

router.get('/dashboard', requireRole('agent', 'team_leader', 'operation_manager'),
  async (req, res) => res.json(await dashboardService[req.user.role](req.user)));

module.exports = router;
