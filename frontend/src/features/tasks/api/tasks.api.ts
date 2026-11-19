import type { Task } from '@/features/tasks/types/tasks.types';
import type { User } from '@/features/users/types/users.types';
import { get, post } from '@/shared/api/client';

export const tasksApi = {
  list: () => get<Task[]>('/tasks'),
  assignees: () => get<User[]>('/tasks/assignees'),
  create: (body: { title: string; description?: string; deadline: string; assignedTo: string[] }) => post<Task>('/tasks', body),
  seen: () => post<void>('/tasks/seen'),
  toggle: (id: string) => post<Task>(`/tasks/${id}/toggle`),
};
