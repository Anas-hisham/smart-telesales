const router = require('express').Router();
const { z } = require('../../utils/schemas');
const { validateRequest } = require('../../middleware/validate');
const { requireRole } = require('../../middleware/auth');
const campaignsService = require('./campaigns.service');

const body = z.object({
  campaignCode: z.string().trim().regex(/^[A-Za-z0-9._-]{1,32}$/, 'Letters, digits, dot, dash or underscore (max 32)'),
  name: z.string().trim().min(1).max(100),
  steps: z.array(z.object({
    type: z.enum(['call', 'email']),
    label: z.string().trim().min(1).max(60),
    gapDays: z.number().int().min(0).max(90),
  })).min(1, 'At least one step').max(30),
});

router.get('/workflows', async (_req, res) => res.json(await campaignsService.listCampaigns()));
router.post('/workflows', requireRole('admin'), validateRequest({ body }), async (req, res) => res.status(201).json(await campaignsService.createCampaign(req.valid.body)));
router.put('/workflows/:code', requireRole('admin'), validateRequest({ body }), async (req, res) => res.json(await campaignsService.updateCampaign(req.params.code, req.valid.body)));
router.delete('/workflows/:code', requireRole('admin'), async (req, res) => { await campaignsService.deleteCampaign(req.params.code); res.status(204).end(); });

module.exports = router;
