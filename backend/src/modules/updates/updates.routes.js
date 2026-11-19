const router = require('express').Router();
const { z } = require('../../utils/schemas');
const { validateRequest } = require('../../middleware/validate');
const { requireRole } = require('../../middleware/auth');
const updatesService = require('./updates.service');

router.get('/updates', async (req, res) => res.json(await updatesService.listUpdates(req.user)));

router.post('/updates', requireRole('operation_manager', 'team_leader'),
  validateRequest({
    body: z.object({
      audience: z.enum(['all', 'team_leaders', 'quality', 'specific_team']),
      title: z.string().trim().min(1).max(200), content: z.string().trim().min(1).max(10000),
    }),
  }),
  async (req, res) => res.status(201).json(await updatesService.createUpdate(req.user, req.valid.body)));

router.post('/updates/seen', async (req, res) => { await updatesService.markUpdatesAsSeen(req.user); res.status(204).end(); });
router.post('/updates/:id/acknowledge', async (req, res) => res.json(await updatesService.acknowledgeUpdate(req.user, req.params.id)));

module.exports = router;
