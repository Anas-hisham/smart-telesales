import type { LoginResponse } from '@/features/auth/types/auth.types';
import type { Badges } from '@/features/notifications/types/notifications.types';
import type { User } from '@/features/users/types/users.types';
import { get, post } from '@/shared/api/client';

export const authApi = {
  login: (username: string, password: string) => post<LoginResponse>('/auth/login', { username, password }, { auth: false }),
  logout: (refreshToken?: string | null) => post<void>('/auth/logout', refreshToken ? { refreshToken } : {}),
  me: () => get<{ user: User; badges: Badges }>('/auth/me'),
};
