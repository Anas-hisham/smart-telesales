const router = require('express').Router();
const { z, uuid, dateString, monthString } = require('../../utils/schemas');
const { validateRequest } = require('../../middleware/validate');
const { requireRole } = require('../../middleware/auth');
const { preventDuplicateRequests } = require('../../middleware/idempotency');
const salesService = require('./sales.service');

const monthQuerySchema = z.object({ month: monthString.optional() });

router.get('/sales/overview', validateRequest({ query: monthQuerySchema }), async (req, res) => res.json(await salesService.getSalesOverview(req.user, req.valid.query.month)));
router.get('/sales/agents/:agentId/details', validateRequest({ query: monthQuerySchema }),
  async (req, res) => res.json(await salesService.getAgentSalesDetails(req.user, req.params.agentId, req.valid.query.month)));

router.post('/sales', requireRole('quality'), preventDuplicateRequests(),
  validateRequest({ body: z.object({ agentId: uuid, leadId: uuid, saleType: z.enum(salesService.SALE_TYPES), date: dateString.optional() }) }),
  async (req, res) => res.status(201).json(await salesService.recordSale(req.user, req.valid.body)));

router.delete('/sales/:id', requireRole('quality'), async (req, res) => { await salesService.deleteSale(req.user, req.params.id); res.status(204).end(); });

module.exports = router;
