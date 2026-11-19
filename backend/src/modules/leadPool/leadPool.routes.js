const router = require('express').Router();
const { z, uuid } = require('../../utils/schemas');
const { validateRequest } = require('../../middleware/validate');
const { requireRole } = require('../../middleware/auth');
const leadPoolService = require('./leadPool.service');

router.post('/lead-pool/preview', requireRole('agent'),
  validateRequest({ body: z.object({ text: z.string().min(1, 'Type at least one lead id').max(200000) }) }),
  async (req, res) => res.json(await leadPoolService.previewLeadsByCodes(req.user, req.valid.body.text)));

router.post('/lead-pool/take', requireRole('agent'),
  validateRequest({ body: z.object({ leadIds: z.array(uuid).min(1).max(1000) }) }),
  async (req, res) => res.json(await leadPoolService.takeLeadsFromPool(req.user, req.valid.body.leadIds)));

module.exports = router;
