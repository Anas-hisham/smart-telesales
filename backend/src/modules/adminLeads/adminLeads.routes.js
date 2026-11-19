const router = require('express').Router();
const { z, uuid } = require('../../utils/schemas');
const { validateRequest } = require('../../middleware/validate');
const { requireRole } = require('../../middleware/auth');
const adminLeadsService = require('./adminLeads.service');

const adminOnly = requireRole('admin');
const importBodySchema = z.object({ campaignCode: z.string().trim().min(1), text: z.string().min(1, 'Paste at least one line').max(2_000_000) });

router.get('/admin/leads', adminOnly,
  validateRequest({
    query: z.object({
      q: z.string().max(100).optional(), filter: z.enum(['all', 'pool', 'assigned']).optional(),
      page: z.coerce.number().int().min(1).optional(), pageSize: z.coerce.number().int().min(1).max(200).optional(),
    }),
  }),
  async (req, res) => res.json(await adminLeadsService.listLeadsForAdmin(req.valid.query)));

router.post('/admin/leads', adminOnly,
  validateRequest({
    body: z.object({
      leadCode: z.string().trim().regex(/^[A-Za-z0-9]{1,40}$/, 'Letters and digits only'),
      campaignCode: z.string().trim().min(1),
      companyName: z.string().trim().min(1).max(200),
      contactName: z.string().trim().min(1).max(200),
      phone: z.string().trim().max(40).optional(),
      email: z.string().trim().email().max(200),
    }),
  }),
  async (req, res) => res.status(201).json(await adminLeadsService.addSingleLead(req.valid.body)));

router.post('/admin/leads/import/preview', adminOnly, validateRequest({ body: importBodySchema }), async (req, res) => res.json(await adminLeadsService.previewLeadImport(req.valid.body)));
router.post('/admin/leads/import', adminOnly, validateRequest({ body: importBodySchema }), async (req, res) => res.status(201).json(await adminLeadsService.importLeadsFromPaste(req.valid.body)));

router.post('/admin/leads/delete', adminOnly,
  validateRequest({ body: z.object({ ids: z.array(uuid).min(1).max(1000) }) }),
  async (req, res) => res.json(await adminLeadsService.deleteLeadsPermanently(req.valid.body.ids)));

module.exports = router;
