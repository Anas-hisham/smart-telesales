const router = require('express').Router();
const { z, uuid, dateString, timeString } = require('../../utils/schemas');
const { validateRequest } = require('../../middleware/validate');
const { requireRole } = require('../../middleware/auth');
const meetingsService = require('./meetings.service');

const STATUS = ['arranged', 'completed', 'no_show', 'cancelled', 'rescheduled'];
const durationMinutesSchema = z.number().int().min(5).max(480);

router.get('/meetings/options', requireRole('agent', 'team_leader', 'operation_manager', 'quality'),
  async (req, res) => res.json(await meetingsService.getMeetingOptions(req.user)));

router.get('/meetings',
  validateRequest({ query: z.object({ from: dateString.optional(), to: dateString.optional(), status: z.enum(STATUS).optional(), type: z.enum(['lead_meeting', 'internal_meeting']).optional() }) }),
  async (req, res) => res.json(await meetingsService.listMeetings(req.user, req.valid.query)));

router.post('/meetings', requireRole('agent', 'team_leader', 'operation_manager', 'quality'),
  validateRequest({
    body: z.object({
      leadId: uuid.optional(), participantIds: z.array(uuid).max(50).optional(), title: z.string().trim().max(200).optional(),
      date: dateString, time: timeString, duration: durationMinutesSchema, notes: z.string().trim().max(4000).optional(), priority: z.enum(['high', 'normal']).optional(),
    }),
  }),
  async (req, res) => res.status(201).json(await meetingsService.createMeeting(req.user, req.valid.body)));

router.patch('/meetings/:id',
  validateRequest({
    body: z.object({
      status: z.enum(STATUS).optional(), outcome: z.string().trim().max(4000).optional(), notes: z.string().trim().max(4000).optional(),
      title: z.string().trim().min(1).max(200).optional(), date: dateString.optional(), time: timeString.optional(), duration: durationMinutesSchema.optional(),
      priority: z.enum(['high', 'normal']).optional(),
    }),
  }),
  async (req, res) => res.json(await meetingsService.updateMeeting(req.user, req.params.id, req.valid.body)));

router.post('/meetings/:id/reschedule',
  validateRequest({ body: z.object({ date: dateString, time: timeString, duration: durationMinutesSchema.optional(), notes: z.string().trim().max(4000).optional() }) }),
  async (req, res) => res.json(await meetingsService.rescheduleMeeting(req.user, req.params.id, req.valid.body)));

module.exports = router;
