import type { User, UserRole } from '@/features/users/types/users.types';
import { get, post } from '@/shared/api/client';

export const usersApi = {
  list: (queryParams: { includeDisabled?: boolean; role?: UserRole; teamId?: string } = {}) => get<User[]>('/users', queryParams),
  create: (body: Record<string, unknown>) => post<User>('/users', body),
};
