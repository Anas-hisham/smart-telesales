import { tipsApi } from '@/features/tips/api/tips.api';
import { tipsUpserted } from '@/features/tips/slice/tips.slice';
import { refreshCollections } from '@/features/workspace/thunks/workspace.thunks';
import { attempt } from '@/shared/api/attempt';
import type { AppThunk } from '@/store/types';

export const sendTips = (tipInput: { agentIds: string[]; title: string; content: string }): AppThunk<boolean> => async dispatch => {
  const result = await attempt(() => tipsApi.create(tipInput));
  if (result) dispatch(tipsUpserted(result.created));
  return !!result;
};
export const acknowledgeTip = (id: string): AppThunk<boolean> => async dispatch => {
  const tip = await attempt(() => tipsApi.acknowledge(id));
  if (tip) dispatch(tipsUpserted([tip]));
  return !!tip;
};
export const markTipsSeen = (_userId?: string): AppThunk => async dispatch => {
  if (await attempt(async () => { await tipsApi.seen(); return true; })) await dispatch(refreshCollections(['tips']));
};
