const router = require('express').Router();
const { z, uuid } = require('../../utils/schemas');
const { validateRequest } = require('../../middleware/validate');
const { requireRole } = require('../../middleware/auth');
const tasksService = require('./tasks.service');

const leadersOnly = requireRole('team_leader', 'operation_manager');

router.get('/tasks', async (req, res) => res.json(await tasksService.listTasks(req.user)));
router.get('/tasks/assignees', leadersOnly, async (req, res) => res.json(await tasksService.listAssignableUsers(req.user)));

router.post('/tasks', leadersOnly,
  validateRequest({
    body: z.object({
      title: z.string().trim().min(1).max(200), description: z.string().trim().max(5000).optional(),
      deadline: z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), 'Use a date (YYYY-MM-DD) or a date-time'),
      assignedTo: z.array(uuid).min(1, 'Choose at least one person').max(200),
    }),
  }),
  async (req, res) => res.status(201).json(await tasksService.createTask(req.user, req.valid.body)));

router.post('/tasks/seen', async (req, res) => { await tasksService.markTasksAsSeen(req.user); res.status(204).end(); });
router.post('/tasks/:id/toggle', async (req, res) => res.json(await tasksService.toggleTaskCompletion(req.user, req.params.id)));

module.exports = router;
