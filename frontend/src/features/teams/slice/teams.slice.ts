import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { sessionEnded } from '@/features/auth/slice/auth.slice';
import type { Team } from '@/features/teams/types/teams.types';

const teamsSlice = createSlice({
  name: 'teams',
  initialState: [] as Team[],
  reducers: {
    setTeams: (_state, action: PayloadAction<Team[]>) => action.payload,
  },
  extraReducers: builder => {
    builder.addCase(sessionEnded, () => []);
  },
});

export const { setTeams } = teamsSlice.actions;
export default teamsSlice.reducer;
