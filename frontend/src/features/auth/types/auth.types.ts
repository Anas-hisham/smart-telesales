import type { User } from '@/features/users/types/users.types';

/** booting = checking a saved login, anonymous = show the login page, ready = signed in */
export type SessionStatus = 'booting' | 'anonymous' | 'ready';

export interface LoginResponse { accessToken: string; refreshToken: string; expiresIn: number; user: User }
