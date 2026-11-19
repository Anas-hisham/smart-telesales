import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/store/rootReducer';
import type { AppState } from '@/store/types';

/** Puts the slices of all the features together in one `AppState` (only changes when one of the slices changes). */
export const selectAppState = createSelector(
  [
    (state: RootState) => state.auth, (state: RootState) => state.users, (state: RootState) => state.teams, (state: RootState) => state.workflows,
    (state: RootState) => state.leads, (state: RootState) => state.meetings, (state: RootState) => state.updates, (state: RootState) => state.tasks,
    (state: RootState) => state.tips, (state: RootState) => state.escalations, (state: RootState) => state.notifications,
  ],
  (auth, users, teams, workflows, leads, meetings, updates, tasks, tips, escalations, notifications): AppState => ({
    session: auth.session,
    loading: auth.loading,
    currentUserId: auth.currentUserId,
    users, teams, workflows, leads, meetings, updates, tasks, tips, escalations,
    notifications: notifications.items,
    badges: notifications.badges,
  }),
);
