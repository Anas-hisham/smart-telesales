import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { sessionEnded } from '@/features/auth/slice/auth.slice';
import type { Task } from '@/features/tasks/types/tasks.types';
import { upsertById } from '@/shared/lib/upsertById';

const tasksSlice = createSlice({
  name: 'tasks',
  initialState: [] as Task[],
  reducers: {
    setTasks: (_state, action: PayloadAction<Task[]>) => action.payload,
    tasksUpserted(state, action: PayloadAction<Task[]>) { upsertById(state, action.payload); },
  },
  extraReducers: builder => {
    builder.addCase(sessionEnded, () => []);
  },
});

export const { setTasks, tasksUpserted } = tasksSlice.actions;
export default tasksSlice.reducer;
