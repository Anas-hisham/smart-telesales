const router = require('express').Router();
const { z } = require('../../utils/schemas');
const { validateRequest } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { rateLimit } = require('../../middleware/rateLimit');
const { formatUserForApi } = require('../../utils/user');
const { getBadges } = require('../notifications/badges');
const authService = require('./auth.service');

// 5 tries a minute per IP + username
const loginLimit = rateLimit({
  windowMs: 60000, max: 5,
  key: (req) => `${req.ip}|${String(req.body?.username || '').toLowerCase()}`,
});

router.post('/auth/login', loginLimit,
  validateRequest({ body: z.object({ username: z.string().min(1), password: z.string().min(1) }) }),
  async (req, res) => res.json(await authService.login(req.valid.body.username, req.valid.body.password)));

router.post('/auth/refresh',
  validateRequest({ body: z.object({ refreshToken: z.string().min(1) }) }),
  async (req, res) => res.json(await authService.refreshSession(req.valid.body.refreshToken)));

router.post('/auth/logout', authenticate,
  validateRequest({ body: z.object({ refreshToken: z.string().optional() }).default({}) }),
  async (req, res) => { await authService.logout(req.user.id, req.valid.body.refreshToken); res.status(204).end(); });

router.get('/auth/me', authenticate, async (req, res) =>
  res.json({ user: formatUserForApi(req.user), badges: await getBadges(req.user.id) }));

module.exports = router;
