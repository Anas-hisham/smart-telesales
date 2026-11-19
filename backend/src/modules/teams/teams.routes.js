const router = require('express').Router();
const { z, uuid } = require('../../utils/schemas');
const { validateRequest } = require('../../middleware/validate');
const { requireRole } = require('../../middleware/auth');
const teamsService = require('./teams.service');


router.get('/teams', async (_req, res) => res.json(await teamsService.listTeams()));

router.get('/teams/:teamId/quality-choices', requireRole('admin'),
  async (req, res) => res.json(await teamsService.qualityChoicesForTeam(req.params.teamId)));

router.get('/agents/:agentId/quality-choices', requireRole('admin'),
  async (req, res) => res.json(await teamsService.qualityChoicesForAgent(req.params.agentId)));

router.put('/agents/:agentId/team', requireRole('admin'),
  validateRequest({ body: z.object({ toTeamId: uuid }) }),
  async (req, res) => res.json(await teamsService.moveAgentToTeam(req.params.agentId, req.valid.body.toTeamId)));

router.put('/teams/:teamId/manager', requireRole('admin'),
  validateRequest({ body: z.object({ managerId: uuid.nullable() }) }),
  async (req, res) => res.json(await teamsService.assignManagerToTeam(req.params.teamId, req.valid.body.managerId)));

router.put('/agents/:agentId/quality', requireRole('admin'),
  validateRequest({ body: z.object({ qualityId: uuid.nullable() }) }),
  async (req, res) => res.json(await teamsService.assignQualityToAgent(req.params.agentId, req.valid.body.qualityId)));

module.exports = router;
