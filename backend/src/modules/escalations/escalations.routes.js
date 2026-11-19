const router = require('express').Router();
const { z, uuid } = require('../../utils/schemas');
const { validateRequest } = require('../../middleware/validate');
const { formatUserForApi } = require('../../utils/user');
const escalationsService = require('./escalations.service');

const note = z.object({ note: z.string().trim().max(4000).optional() });

router.get('/escalations/subjects', async (req, res) => res.json((await escalationsService.listPeopleToEscalateAbout(req.user)).map(formatUserForApi)));
router.get('/escalations/recipients', validateRequest({ query: z.object({ aboutId: uuid }) }),
  async (req, res) => res.json(await escalationsService.listEscalationRecipients(req.user, req.valid.query.aboutId)));
router.get('/escalations', async (req, res) => res.json(await escalationsService.listEscalations(req.user)));

router.post('/escalations',
  validateRequest({ body: z.object({ aboutId: uuid, recipientId: uuid, title: z.string().trim().min(1).max(200), details: z.string().trim().min(1).max(10000) }) }),
  async (req, res) => res.status(201).json(await escalationsService.createEscalation(req.user, req.valid.body)));
router.post('/escalations/:id/forward', validateRequest({ body: note.extend({ toId: uuid }) }),
  async (req, res) => res.json(await escalationsService.forwardEscalation(req.user, req.params.id, req.valid.body)));
router.post('/escalations/:id/resolve', validateRequest({ body: note }),
  async (req, res) => res.json(await escalationsService.resolveEscalation(req.user, req.params.id, req.valid.body)));

module.exports = router;
