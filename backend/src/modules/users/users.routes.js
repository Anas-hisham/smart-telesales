const router = require('express').Router();
const { z, uuid, booleanString } = require('../../utils/schemas');
const env = require('../../config/env');
const { Errors } = require('../../utils/errors');
const { validateRequest } = require('../../middleware/validate');
const { requireRole } = require('../../middleware/auth');
const usersService = require('./users.service');

const ROLES = ['admin', 'operation_manager', 'team_leader', 'agent', 'quality'];
const usernameRule = z.string().trim().regex(/^[A-Za-z0-9._-]{3,32}$/, '3-32 letters, digits, dot, dash or underscore');


router.get('/users',
  validateRequest({ query: z.object({ role: z.enum(ROLES).optional(), teamId: uuid.optional(), lob: z.enum(env.lobs).optional(), includeDisabled: booleanString.optional() }) }),
  async (req, res) => res.json(await usersService.listUsers(req.valid.query, req.user)));

router.post('/users', requireRole('admin'),
  validateRequest({
    body: z.object({
      username: usernameRule,
      password: z.string().min(8, 'At least 8 characters').max(100),
      name: z.string().trim().min(1).max(100),
      email: z.string().trim().email().max(200),
      role: z.enum(['operation_manager', 'team_leader', 'agent', 'quality']),
      teamId: uuid.nullish(),
      lob: z.string().nullish(),
      qualityId: uuid.nullish(),
      teamName: z.string().trim().min(1).max(80).nullish(),
      managerId: uuid.nullish(),
      dailyCallTarget: z.number().int().min(1).max(500).optional(),
    }),
  }),
  async (req, res) => res.status(201).json(await usersService.createUser(req.valid.body)));

router.patch('/users/:id', requireRole('admin'),
  validateRequest({
    body: z.object({
      username: usernameRule.optional(),
      name: z.string().trim().min(1).max(100).optional(),
      email: z.string().trim().email().max(200).optional(),
      dailyCallTarget: z.number().int().min(1).max(500).optional(),
      active: z.boolean().optional(),
    }).strict(),
  }),
  async (req, res) => {
    if (req.valid.body.active === false && req.params.id === req.user.id) {
      throw Errors.conflict('USER_HAS_DEPENDENTS', 'You cannot disable yourself', [{ field: 'active', message: 'The admin making the call cannot be disabled' }]);
    }
    res.json(await usersService.updateUser(req.params.id, req.valid.body));
  });

router.post('/users/:id/reset-password', requireRole('admin'),
  validateRequest({ body: z.object({ password: z.string().min(8, 'At least 8 characters').max(100) }) }),
  async (req, res) => { await usersService.resetPassword(req.params.id, req.valid.body.password); res.status(204).end(); });

module.exports = router;
