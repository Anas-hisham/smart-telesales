import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { sessionEnded, sessionReady } from '@/features/auth/slice/auth.slice';
import type { Badges, Notification } from '@/features/notifications/types/notifications.types';

interface NotificationsState {
  items: Notification[];
  /** The numbers shown next to the menu items (computed by the server). */
  badges: Badges;
}

const NO_BADGES: Badges = { updates: 0, tasks: 0, tips: 0, escalations: 0 };
const initialState = (): NotificationsState => ({ items: [], badges: NO_BADGES });

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setNotifications(state, action: PayloadAction<Notification[]>) { state.items = action.payload; },
    setBadges(state, action: PayloadAction<Badges>) { state.badges = action.payload; },
    notificationsRead(state, action: PayloadAction<string[] | 'all'>) {
      for (const notification of state.items) if (action.payload === 'all' || action.payload.includes(notification.id)) notification.read = true;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(sessionReady, (state, action) => { if (action.payload.badges) state.badges = action.payload.badges; })
      .addCase(sessionEnded, () => initialState());
  },
});

export const { setNotifications, setBadges, notificationsRead } = notificationsSlice.actions;
export default notificationsSlice.reducer;
