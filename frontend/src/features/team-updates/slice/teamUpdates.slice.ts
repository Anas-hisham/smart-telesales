import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { sessionEnded } from '@/features/auth/slice/auth.slice';
import type { TeamUpdate } from '@/features/team-updates/types/teamUpdates.types';
import { upsertById } from '@/shared/lib/upsertById';

const teamUpdatesSlice = createSlice({
  name: 'updates',
  initialState: [] as TeamUpdate[],
  reducers: {
    setUpdates: (_state, action: PayloadAction<TeamUpdate[]>) => action.payload,
    updatesUpserted(state, action: PayloadAction<TeamUpdate[]>) { upsertById(state, action.payload); },
  },
  extraReducers: builder => {
    builder.addCase(sessionEnded, () => []);
  },
});

export const { setUpdates, updatesUpserted } = teamUpdatesSlice.actions;
export default teamUpdatesSlice.reducer;
