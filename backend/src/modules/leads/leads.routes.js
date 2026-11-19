const router = require('express').Router();
const { z, uuid, booleanString } = require('../../utils/schemas');
const { validateRequest } = require('../../middleware/validate');
const { requireRole } = require('../../middleware/auth');
const leadsService = require('./leads.service');

const STATUS = ['new', 'discovery', 'lvm', 'nvm', 'no_response', 'arranged_meeting'];

router.get('/leads',
  validateRequest({
    query: z.object({
      agentId: uuid.optional(), campaignCode: z.string().optional(), status: z.enum(STATUS).optional(),
      bucket: z.enum(['today', 'next', 'stop', 'finished']).optional(), q: z.string().max(100).optional(),
      expired: booleanString.optional(), includeRemoved: booleanString.optional(),
      page: z.coerce.number().int().min(1).optional(), pageSize: z.coerce.number().int().min(1).max(200).optional(),
    }),
  }),
  async (req, res) => res.json(await leadsService.listLeads(req.user, req.valid.query)));

router.get('/me/work-queue', requireRole('agent'), async (req, res) => res.json(await leadsService.getAgentWorkQueue(req.user)));

router.get('/leads/:id', async (req, res) => res.json(await leadsService.getLeadDetails(req.user, req.params.id)));

module.exports = router;
