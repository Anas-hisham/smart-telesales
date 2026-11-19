import { teamsApi } from '@/features/teams/api/teams.api';
import { setTeams } from '@/features/teams/slice/teams.slice';
import { usersUpserted } from '@/features/users/slice/users.slice';
import { refreshCollections } from '@/features/workspace/thunks/workspace.thunks';
import { attempt } from '@/shared/api/attempt';
import type { AppThunk } from '@/store/types';

export const loadTeams = (): AppThunk => async dispatch => {
  const teams = await attempt(() => teamsApi.list());
  if (teams) dispatch(setTeams(teams));
};

export const moveAgentToTeam = (params: { agentId: string; toTeamId: string }): AppThunk<boolean> => async dispatch => {
  const result = await attempt(() => teamsApi.moveAgent(params.agentId, params.toTeamId));
  if (!result) return false;
  dispatch(setTeams(result.teams));
  dispatch(usersUpserted([result.agent]));
  return true;
};

export const assignTeamToManager = (params: { teamId: string; managerId: string }): AppThunk<boolean> => async dispatch => {
  const result = await attempt(() => teamsApi.setManager(params.teamId, params.managerId || null));
  if (!result) return false;
  await Promise.all([dispatch(refreshCollections(['users'])), dispatch(loadTeams())]);
  return true;
};

export const setAgentQuality = (params: { agentId: string; qualityId: string }): AppThunk<boolean> => async dispatch => {
  const user = await attempt(() => teamsApi.setQuality(params.agentId, params.qualityId || null));
  if (user) dispatch(usersUpserted([user]));
  return !!user;
};
