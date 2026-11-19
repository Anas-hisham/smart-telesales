const router = require('express').Router();
const { z, uuid } = require('../../utils/schemas');
const { validateRequest } = require('../../middleware/validate');
const { requireRole } = require('../../middleware/auth');
const tipsService = require('./tips.service');

router.get('/tips', async (req, res) => res.json(await tipsService.listTips(req.user)));
router.get('/tips/recipients', requireRole('quality'), async (req, res) => res.json(await tipsService.listFollowedAgentsGroupedByTeam(req.user)));

router.post('/tips', requireRole('quality'),
  validateRequest({ body: z.object({ agentIds: z.array(uuid).min(1).max(200), title: z.string().trim().min(1).max(200), content: z.string().trim().min(1).max(10000) }) }),
  async (req, res) => res.status(201).json(await tipsService.createTips(req.user, req.valid.body)));

router.post('/tips/seen', async (req, res) => { await tipsService.markTipsAsSeen(req.user); res.status(204).end(); });
router.post('/tips/:id/acknowledge', requireRole('agent'), async (req, res) => res.json(await tipsService.acknowledgeTip(req.user, req.params.id)));

module.exports = router;
