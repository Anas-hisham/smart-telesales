// Every module exposes an Express router with its full paths; they are all mounted on /api/v1.
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');

router.use(require('./auth/auth.routes')); // login / refresh are public

router.use(authenticate); // everything below needs a signed-in user
router.use(require('./users/users.routes'));
router.use(require('./teams/teams.routes'));
router.use(require('./campaigns/campaigns.routes'));
router.use(require('./adminLeads/adminLeads.routes'));
router.use(require('./leadPool/leadPool.routes'));
router.use(require('./leads/leads.routes'));
router.use(require('./leads/leadActions.routes'));
router.use(require('./meetings/meetings.routes'));
router.use(require('./updates/updates.routes'));
router.use(require('./tasks/tasks.routes'));
router.use(require('./tips/tips.routes'));
router.use(require('./sales/sales.routes'));
router.use(require('./escalations/escalations.routes'));
router.use(require('./notifications/notifications.routes'));
router.use(require('./dashboard/dashboard.routes'));
router.use(require('./analytics/analytics.routes'));

module.exports = router;
