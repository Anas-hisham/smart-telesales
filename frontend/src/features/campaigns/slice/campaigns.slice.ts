import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { sessionEnded } from '@/features/auth/slice/auth.slice';
import type { Workflow } from '@/features/campaigns/types/campaigns.types';

const campaignsSlice = createSlice({
  name: 'workflows',
  initialState: [] as Workflow[],
  reducers: {
    setWorkflows: (_state, action: PayloadAction<Workflow[]>) => action.payload,
  },
  extraReducers: builder => {
    builder.addCase(sessionEnded, () => []);
  },
});

export const { setWorkflows } = campaignsSlice.actions;
export default campaignsSlice.reducer;
