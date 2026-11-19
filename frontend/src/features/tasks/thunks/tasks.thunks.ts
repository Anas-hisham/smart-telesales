import { tasksApi } from '@/features/tasks/api/tasks.api';
import { tasksUpserted } from '@/features/tasks/slice/tasks.slice';
import { refreshCollections } from '@/features/workspace/thunks/workspace.thunks';
import { attempt } from '@/shared/api/attempt';
import type { AppThunk } from '@/store/types';

export const createTask = (taskInput: { title: string; description?: string; deadline: string; assignedTo: string[] }): AppThunk<boolean> => async dispatch => {
  const task = await attempt(() => tasksApi.create({ title: taskInput.title.trim(), description: taskInput.description?.trim() || undefined, deadline: taskInput.deadline, assignedTo: taskInput.assignedTo }));
  if (task) dispatch(tasksUpserted([task]));
  return !!task;
};
export const toggleTaskCompletion = (params: { taskId: string; userId?: string }): AppThunk<boolean> => async dispatch => {
  const task = await attempt(() => tasksApi.toggle(params.taskId));
  if (task) dispatch(tasksUpserted([task]));
  return !!task;
};
export const markTasksSeen = (_userId?: string): AppThunk => async dispatch => {
  if (await attempt(async () => { await tasksApi.seen(); return true; })) await dispatch(refreshCollections(['tasks']));
};
