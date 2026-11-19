const router = require('express').Router();
const { z, uuid } = require('../../utils/schemas');
const { Errors } = require('../../utils/errors');
const { validateRequest } = require('../../middleware/validate');
const { requireRole } = require('../../middleware/auth');
const { preventDuplicateRequests } = require('../../middleware/idempotency');
const leadActionsService = require('./leadActions.service');

const REASONS = ['interested', 'callback', 'price', 'timing', 'not_interested', 'wrong_contact', 'no_answer', 'voicemail', 'other'];
const agentOnly = requireRole('agent');
const readTouchPointOrderFromUrl = (req) => { const parsedOrder = Number.parseInt(req.params.order, 10); if (Number.isNaN(parsedOrder)) throw Errors.notFound('Touch point'); return parsedOrder; };

for (const kind of ['complete', 'skip', 'restore']) {
  router.post(`/leads/:id/touch-points/:order/${kind}`, agentOnly,
    async (req, res) => res.json(await leadActionsService.changeTouchPointStatus(req.user, req.params.id, readTouchPointOrderFromUrl(req), kind)));
}

router.post('/leads/:id/calls', agentOnly, preventDuplicateRequests(),
  validateRequest({
    body: z.object({
      type: z.enum(['nvm', 'lvm', 'discovery']),
      reason: z.enum(REASONS).optional(),
      description: z.string().trim().min(1, 'Required').max(2000),
      touchPointOrder: z.number().int().min(0),
      completeTouchPoint: z.boolean(),
    }),
  }),
  async (req, res) => res.status(201).json(await leadActionsService.logCall(req.user, req.params.id, req.valid.body)));

router.patch('/leads/:id/calls/:logId', agentOnly,
  validateRequest({ body: z.object({ type: z.enum(['nvm', 'lvm', 'discovery']), description: z.string().trim().min(1, 'Required').max(2000) }) }),
  async (req, res) => res.json(await leadActionsService.editCall(req.user, req.params.id, req.params.logId, req.valid.body)));

router.post('/leads/:id/stop', agentOnly, async (req, res) => res.json(await leadActionsService.stopLeadWorkflow(req.user, req.params.id)));
router.post('/leads/:id/resume', agentOnly, async (req, res) => res.json(await leadActionsService.resumeLeadWorkflow(req.user, req.params.id)));
router.post('/leads/:id/remove', agentOnly, async (req, res) => res.json(await leadActionsService.removeLeadFromQueue(req.user, req.params.id)));

router.post('/leads/:id/transfer', requireRole('team_leader', 'operation_manager'),
  validateRequest({ body: z.object({ newAgentId: uuid }) }),
  async (req, res) => res.json(await leadActionsService.transferLeadToAgent(req.user, req.params.id, req.valid.body.newAgentId)));

module.exports = router;
