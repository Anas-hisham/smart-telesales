import { notificationsApi } from '@/features/notifications/api/notifications.api';
import { notificationsRead } from '@/features/notifications/slice/notifications.slice';
import { attempt } from '@/shared/api/attempt';
import type { AppThunk } from '@/store/types';

export const markNotificationRead = (id: string): AppThunk => async dispatch => {
  dispatch(notificationsRead([id]));                       // instant; the server confirms
  await attempt(() => notificationsApi.read(id));
};
export const markAllNotificationsRead = (): AppThunk => async dispatch => {
  dispatch(notificationsRead('all'));
  await attempt(() => notificationsApi.readAll());
};
