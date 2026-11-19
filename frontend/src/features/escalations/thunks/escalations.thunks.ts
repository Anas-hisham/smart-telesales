import { escalationsApi } from '@/features/escalations/api/escalations.api';
import { refreshCollections } from '@/features/workspace/thunks/workspace.thunks';
import { attempt } from '@/shared/api/attempt';
import type { AppThunk } from '@/store/types';

export const createEscalation = (newEscalation: { aboutId: string; recipientId: string; title: string; details: string }): AppThunk<boolean> => async dispatch => {
  const escalation = await attempt(() => escalationsApi.create(newEscalation));
  if (escalation) await dispatch(refreshCollections(['escalations']));
  return !!escalation;
};
export const forwardEscalation = (params: { id: string; toId: string; note?: string }): AppThunk<boolean> => async dispatch => {
  const escalation = await attempt(() => escalationsApi.forward(params.id, { toId: params.toId, note: params.note }));
  if (escalation) await dispatch(refreshCollections(['escalations']));
  return !!escalation;
};
export const resolveEscalation = (params: { id: string; note?: string }): AppThunk<boolean> => async dispatch => {
  const escalation = await attempt(() => escalationsApi.resolve(params.id, { note: params.note }));
  if (escalation) await dispatch(refreshCollections(['escalations']));
  return !!escalation;
};
