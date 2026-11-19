import { teamUpdatesApi } from '@/features/team-updates/api/teamUpdates.api';
import { updatesUpserted } from '@/features/team-updates/slice/teamUpdates.slice';
import { refreshCollections } from '@/features/workspace/thunks/workspace.thunks';
import { attempt } from '@/shared/api/attempt';
import type { AppThunk } from '@/store/types';

export const postTeamUpdate = (updateInput: { audience: string; title: string; content: string }): AppThunk<boolean> => async dispatch => {
  const teamUpdate = await attempt(() => teamUpdatesApi.create({ audience: updateInput.audience, title: updateInput.title.trim(), content: updateInput.content.trim() }));
  if (teamUpdate) dispatch(updatesUpserted([teamUpdate]));
  return !!teamUpdate;
};
export const acknowledgeTeamUpdate = (updateId: string): AppThunk<boolean> => async dispatch => {
  const teamUpdate = await attempt(() => teamUpdatesApi.acknowledge(updateId));
  if (teamUpdate) { dispatch(updatesUpserted([teamUpdate])); void dispatch(refreshCollections(['notifications'])); }
  return !!teamUpdate;
};
export const markUpdatesSeen = (_userId?: string): AppThunk => async dispatch => {
  if (await attempt(async () => { await teamUpdatesApi.seen(); return true; })) await dispatch(refreshCollections(['updates']));
};
