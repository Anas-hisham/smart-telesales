/** All the slices of the app, one per feature. Add a new feature slice here. */
import { combineReducers } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/slice/auth.slice';
import campaignsReducer from '@/features/campaigns/slice/campaigns.slice';
import escalationsReducer from '@/features/escalations/slice/escalations.slice';
import leadsReducer from '@/features/leads/slice/leads.slice';
import meetingsReducer from '@/features/meetings/slice/meetings.slice';
import notificationsReducer from '@/features/notifications/slice/notifications.slice';
import tasksReducer from '@/features/tasks/slice/tasks.slice';
import teamUpdatesReducer from '@/features/team-updates/slice/teamUpdates.slice';
import teamsReducer from '@/features/teams/slice/teams.slice';
import tipsReducer from '@/features/tips/slice/tips.slice';
import usersReducer from '@/features/users/slice/users.slice';

export const rootReducer = combineReducers({
  auth: authReducer,
  users: usersReducer,
  teams: teamsReducer,
  workflows: campaignsReducer,
  leads: leadsReducer,
  meetings: meetingsReducer,
  updates: teamUpdatesReducer,
  tasks: tasksReducer,
  tips: tipsReducer,
  escalations: escalationsReducer,
  notifications: notificationsReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
