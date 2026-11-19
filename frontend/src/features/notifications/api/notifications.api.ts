import type { Badges, NotificationPage } from '@/features/notifications/types/notifications.types';
import { get, post } from '@/shared/api/client';

export const notificationsApi = {
  list: (queryParams: { unread?: boolean; page?: number; pageSize?: number } = {}) => get<NotificationPage>('/notifications', queryParams),
  readAll: () => post<void>('/notifications/read-all'),
  read: (id: string) => post<unknown>(`/notifications/${id}/read`),
  badges: () => get<Badges>('/me/badges'),
};
