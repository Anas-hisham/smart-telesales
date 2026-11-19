import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { sessionEnded } from '@/features/auth/slice/auth.slice';
import type { Meeting } from '@/features/meetings/types/meetings.types';
import { upsertById } from '@/shared/lib/upsertById';

const meetingsSlice = createSlice({
  name: 'meetings',
  initialState: [] as Meeting[],
  reducers: {
    setMeetings: (_state, action: PayloadAction<Meeting[]>) => action.payload,
    meetingsUpserted(state, action: PayloadAction<Meeting[]>) { upsertById(state, action.payload); },
  },
  extraReducers: builder => {
    builder.addCase(sessionEnded, () => []);
  },
});

export const { setMeetings, meetingsUpserted } = meetingsSlice.actions;
export default meetingsSlice.reducer;
