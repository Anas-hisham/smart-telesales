import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { sessionEnded } from '@/features/auth/slice/auth.slice';
import type { Tip } from '@/features/tips/types/tips.types';
import { upsertById } from '@/shared/lib/upsertById';

const tipsSlice = createSlice({
  name: 'tips',
  initialState: [] as Tip[],
  reducers: {
    setTips: (_state, action: PayloadAction<Tip[]>) => action.payload,
    tipsUpserted(state, action: PayloadAction<Tip[]>) { upsertById(state, action.payload); },
  },
  extraReducers: builder => {
    builder.addCase(sessionEnded, () => []);
  },
});

export const { setTips, tipsUpserted } = tipsSlice.actions;
export default tipsSlice.reducer;
