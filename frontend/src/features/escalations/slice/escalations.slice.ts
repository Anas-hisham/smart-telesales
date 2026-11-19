import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { sessionEnded } from '@/features/auth/slice/auth.slice';
import type { Escalation } from '@/features/escalations/types/escalations.types';

const escalationsSlice = createSlice({
  name: 'escalations',
  initialState: [] as Escalation[],
  reducers: {
    setEscalations: (_state, action: PayloadAction<Escalation[]>) => action.payload,
  },
  extraReducers: builder => {
    builder.addCase(sessionEnded, () => []);
  },
});

export const { setEscalations } = escalationsSlice.actions;
export default escalationsSlice.reducer;
