import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { sessionEnded } from '@/features/auth/slice/auth.slice';
import type { CallLog } from '@/features/leads/types/callLog.types';
import type { Lead } from '@/features/leads/types/leads.types';

/** Agents only: the leads of the signed-in agent. */
const leadsSlice = createSlice({
  name: 'leads',
  initialState: [] as Lead[],
  reducers: {
    /** The agent's whole lead list. Call logs / history already loaded are kept. */
    leadsReplaced(state, action: PayloadAction<Lead[]>) {
      const old = new Map(state.map(lead => [lead.id, lead]));
      const next = action.payload.map(lead => {
        const previousLead = old.get(lead.id);
        return previousLead && previousLead.detailLoaded && !lead.detailLoaded ? { ...lead, callLogs: previousLead.callLogs, history: previousLead.history, previousAssignments: previousLead.previousAssignments, detailLoaded: previousLead.detailLoaded } : lead;
      });
      state.splice(0, state.length, ...next);
    },
    leadUpserted(state, action: PayloadAction<Lead>) {
      const index = state.findIndex(lead => lead.id === action.payload.id);
      if (index >= 0) state[index] = action.payload; else state.unshift(action.payload);
    },
    leadsRemoved(state, action: PayloadAction<string[]>) {
      const ids = new Set(action.payload);
      return state.filter(lead => !ids.has(lead.id));
    },
    /** A call just saved: show it at once in the lead that is already open. */
    callLogMerged(state, action: PayloadAction<{ leadId: string; log: CallLog }>) {
      const lead = state.find(candidateLead => candidateLead.id === action.payload.leadId);
      if (!lead) return;
      const index = lead.callLogs.findIndex(callLog => callLog.id === action.payload.log.id);
      if (index >= 0) lead.callLogs[index] = action.payload.log; else lead.callLogs.push(action.payload.log);
    },
  },
  extraReducers: builder => {
    builder.addCase(sessionEnded, () => []);
  },
});

export const { leadsReplaced, leadUpserted, leadsRemoved, callLogMerged } = leadsSlice.actions;
export default leadsSlice.reducer;
