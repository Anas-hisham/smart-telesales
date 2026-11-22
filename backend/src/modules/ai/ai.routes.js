const router = require('express').Router();
const { z, uuid, booleanString } = require('../../utils/schemas');
const { validateRequest } = require('../../middleware/validate');
const { requireRole } = require('../../middleware/auth');
const { rateLimit } = require('../../middleware/rateLimit');
const aiService = require('./ai.service');

// Gemini calls cost money: 6 per minute per user
const aiLimit = rateLimit({ windowMs: 60000, max: 6, key: (req) => req.user.id });

// Agent opens a lead -> "Analyze with AI" -> strategy, script, predicted objections
router.post('/leads/:id/ai-analysis', aiLimit,
  validateRequest({ body: z.object({ lang: z.enum(['ar', 'en', 'ar_en']).optional(), refresh: z.boolean().optional() }).default({}) }),
  async (req, res) => res.json(await aiService.analyzeLead(req.user, req.params.id, req.valid.body)));

// Company knowledge base (what the AI is allowed to say about products, prices, objections...)
const manage = requireRole('admin', 'operation_manager');
const knowledgeBody = {
  campaignCode: z.string().trim().min(1).max(50).nullable().optional(),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(20000),
};
router.get('/ai/knowledge', manage, async (_req, res) => res.json(await aiService.listKnowledge()));
router.post('/ai/knowledge', manage, validateRequest({ body: z.object(knowledgeBody) }),
  async (req, res) => res.status(201).json(await aiService.createKnowledge(req.user, req.valid.body)));
router.patch('/ai/knowledge/:id', manage,
  validateRequest({ body: z.object({ ...knowledgeBody, title: knowledgeBody.title.optional(), content: knowledgeBody.content.optional(), active: z.boolean().optional() }) }),
  async (req, res) => res.json(await aiService.updateKnowledge(req.params.id, req.valid.body)));
router.delete('/ai/knowledge/:id', manage, async (req, res) => { await aiService.deleteKnowledge(req.params.id); res.status(204).end(); });

module.exports = router;
