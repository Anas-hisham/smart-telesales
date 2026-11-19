import type { UnknownAction } from '@reduxjs/toolkit';
import { leadPoolApi } from '@/features/leads/api/leadPool.api';
import { leadsApi } from '@/features/leads/api/leads.api';
import { callLogMerged, leadsRemoved, leadsReplaced, leadUpserted } from '@/features/leads/slice/leads.slice';
import type { CallLog, CallType } from '@/features/leads/types/callLog.types';
import { leadFromApi } from '@/features/leads/utils/leadMappers';
import { attempt } from '@/shared/api/attempt';
import { reportError, reportNotice } from '@/shared/api/apiErrors';
import type { RootState } from '@/store/rootReducer';
import type { AppThunk } from '@/store/types';

// ───────────────────────────── loading ─────────────────────────────
/** Every page of the agent's lead list. */
async function fetchAllLeads() {
  const results = [];
  for (let page = 1; ; page++) {
    const leadsPage = await leadsApi.list({ pageSize: 200, page });
    results.push(...leadsPage.items);
    if (results.length >= leadsPage.total || leadsPage.items.length === 0) return results;
  }
}

/** Agents only: load the whole lead list of the signed-in agent. */
export const refreshLeads = (): AppThunk => async (dispatch, getState) => {
  const { users, auth } = getState();
  if (users.find(user => user.id === auth.currentUserId)?.role !== 'agent') return;
  const items = await attempt(fetchAllLeads);
  if (items) dispatch(leadsReplaced(items.map(lead => leadFromApi(lead))));
};

/** Open lead: load its call logs / history / previous rounds. */
export const loadLeadDetail = (leadId: string): AppThunk => async dispatch => {
  const leadDetail = await attempt(() => leadsApi.detail(leadId));
  if (leadDetail) dispatch(leadUpserted(leadFromApi(leadDetail)));
};

// ───────────────────────────── a lead (agent) ─────────────────────────────
/**
 * Store a lead the server sent back. If the server just released it (the last touch point was done, so it went
 * back to the pool), it leaves my list at once and the agent is told why.
 */
const upsertLead = (dispatch: (action: UnknownAction) => unknown, getState: () => RootState, apiLead: Parameters<typeof leadFromApi>[0]) => {
  if (apiLead.removedFromQueue) {
    dispatch(leadsRemoved([apiLead.id]));
    reportNotice(`${apiLead.companyName} (${apiLead.leadCode}) finished all its steps and went back to the pool.`);
    return;
  }
  dispatch(leadUpserted(leadFromApi(apiLead, getState().leads.find(lead => lead.id === apiLead.id))));
};

export const completeTouchPoint = (params: { leadId: string; order: number }): AppThunk<boolean> => async (dispatch, getState) => {
  const apiLead = await attempt(() => leadsApi.step(params.leadId, params.order, 'complete'));
  if (apiLead) upsertLead(dispatch, getState, apiLead);
  return !!apiLead;
};
export const skipTouchPoint = (params: { leadId: string; order: number }): AppThunk<boolean> => async (dispatch, getState) => {
  const apiLead = await attempt(() => leadsApi.step(params.leadId, params.order, 'skip'));
  if (apiLead) upsertLead(dispatch, getState, apiLead);
  return !!apiLead;
};
export const restoreSkippedTouchPoint = (params: { leadId: string; order: number }): AppThunk<boolean> => async (dispatch, getState) => {
  const apiLead = await attempt(() => leadsApi.step(params.leadId, params.order, 'restore'));
  if (apiLead) upsertLead(dispatch, getState, apiLead);
  return !!apiLead;
};

type CallInput = { type: CallType; description: string; touchPointOrder: number; reason?: CallLog['reason'] };
const logCall = (leadId: string, log: CallInput, completeTouchPoint: boolean): AppThunk<boolean> => async (dispatch, getState) => {
  const result = await attempt(() => leadsApi.logCall(leadId, { ...log, description: log.description.trim(), completeTouchPoint }));
  if (!result) return false;
  upsertLead(dispatch, getState, result.lead);
  dispatch(callLogMerged({ leadId, log: result.callLog }));
  return true;
};
/** One atomic call on the server: the call log and the completed step cannot get out of sync. */
export const logCallAndCompleteTouchPoint = (params: { leadId: string; log: CallInput }) => logCall(params.leadId, params.log, true);
export const addCallLogWithoutCompletingTouchPoint = (params: { leadId: string; log: CallInput }) => logCall(params.leadId, params.log, false);

export const editCallLog = (params: { leadId: string; logId: string; callType: CallType; description: string }): AppThunk<boolean> => async (dispatch, getState) => {
  const result = await attempt(() => leadsApi.editCall(params.leadId, params.logId, { type: params.callType, description: params.description.trim() }));
  if (!result) return false;
  upsertLead(dispatch, getState, result.lead);
  dispatch(callLogMerged({ leadId: params.leadId, log: result.callLog }));
  return true;
};

export const stopLeadWorkflow = (leadId: string): AppThunk<boolean> => async (dispatch, getState) => {
  const apiLead = await attempt(() => leadsApi.stop(leadId));
  if (apiLead) upsertLead(dispatch, getState, apiLead);
  return !!apiLead;
};
export const resumeLeadWorkflow = (leadId: string): AppThunk<boolean> => async (dispatch, getState) => {
  const apiLead = await attempt(() => leadsApi.resume(leadId));
  if (apiLead) upsertLead(dispatch, getState, apiLead);
  return !!apiLead;
};
/** The lead leaves my queue and goes back to the pool (agents can remove a lead, never delete it; a recorded sale does not block this). */
export const removeLeadFromAgentQueue = (leadId: string): AppThunk<boolean> => async dispatch => {
  const result = await attempt(() => leadsApi.remove(leadId));
  if (result) dispatch(leadsRemoved([leadId]));
  return !!result;
};

/** Take leads from the pool by their ids (the ids come from POST /lead-pool/preview). */
export const takeLeadsFromPool = (leadIds: string[]): AppThunk<boolean> => async (dispatch, getState) => {
  const takeResult = await attempt(() => leadPoolApi.take(leadIds));
  if (!takeResult) return false;
  for (const apiLead of takeResult.taken) upsertLead(dispatch, getState, apiLead);
  if (takeResult.skipped.length) reportError(`${takeResult.skipped.length} lead${takeResult.skipped.length === 1 ? ' was' : 's were'} not taken: somebody else got ${takeResult.skipped.length === 1 ? 'it' : 'them'} first.`);
  return true;
};

/** Team Leader / Operation Manager: give a lead to another agent (a new round starts). */
export const transferLeadToAgent = (params: { leadId: string; newAgentId: string }): AppThunk<boolean> => async () => {
  const apiLead = await attempt(() => leadsApi.transfer(params.leadId, params.newAgentId));
  return !!apiLead;
};
