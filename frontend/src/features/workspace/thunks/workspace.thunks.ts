/**
 * Loading the data of the app from the API.
 *  - refreshAll: first load after sign-in
 *  - refreshTick: what changes while the person works (every 30 seconds)
 *  - refreshCollections: reload some lists (the server scopes each one by the role of the signed-in person)
 */
import { campaignsApi } from '@/features/campaigns/api/campaigns.api';
import { setWorkflows } from '@/features/campaigns/slice/campaigns.slice';
import { loadFinished } from '@/features/auth/slice/auth.slice';
import { escalationsApi } from '@/features/escalations/api/escalations.api';
import { setEscalations } from '@/features/escalations/slice/escalations.slice';
import { refreshLeads } from '@/features/leads/thunks/leads.thunks';
import { meetingsApi } from '@/features/meetings/api/meetings.api';
import { setMeetings } from '@/features/meetings/slice/meetings.slice';
import { notificationsApi } from '@/features/notifications/api/notifications.api';
import { setBadges, setNotifications } from '@/features/notifications/slice/notifications.slice';
import { tasksApi } from '@/features/tasks/api/tasks.api';
import { setTasks } from '@/features/tasks/slice/tasks.slice';
import { teamUpdatesApi } from '@/features/team-updates/api/teamUpdates.api';
import { setUpdates } from '@/features/team-updates/slice/teamUpdates.slice';
import { teamsApi } from '@/features/teams/api/teams.api';
import { setTeams } from '@/features/teams/slice/teams.slice';
import { tipsApi } from '@/features/tips/api/tips.api';
import { setTips } from '@/features/tips/slice/tips.slice';
import { usersApi } from '@/features/users/api/users.api';
import { setUsers } from '@/features/users/slice/users.slice';
import { attempt } from '@/shared/api/attempt';
import { localDay } from '@/shared/lib/dates';
import type { AppThunk } from '@/store/types';

export type CollectionKey = 'users' | 'meetings' | 'updates' | 'tasks' | 'tips' | 'escalations' | 'notifications';

/** Load the list collections the signed-in person can see (the server scopes each one by role). The menu badges are always reloaded. */
export const refreshCollections = (keys: CollectionKey[] | 'all' = 'all'): AppThunk => async dispatch => {
  const shouldRefresh = (paramKey: string) => keys === 'all' || (keys as string[]).includes(paramKey);
  const from = localDay(Date.now() - 120 * 86400000);
  const [users, meetings, updates, tasks, tips, escalations, notifications, badges] = await Promise.all([
    shouldRefresh('users') ? attempt(() => usersApi.list()) : undefined,
    shouldRefresh('meetings') ? attempt(() => meetingsApi.list({ from })) : undefined,
    shouldRefresh('updates') ? attempt(() => teamUpdatesApi.list()) : undefined,
    shouldRefresh('tasks') ? attempt(() => tasksApi.list()) : undefined,
    shouldRefresh('tips') ? attempt(() => tipsApi.list()) : undefined,
    shouldRefresh('escalations') ? attempt(() => escalationsApi.list()) : undefined,
    shouldRefresh('notifications') ? attempt(() => notificationsApi.list({ pageSize: 100 })) : undefined,
    attempt(() => notificationsApi.badges()),
  ]);
  if (users) dispatch(setUsers(users));
  if (meetings) dispatch(setMeetings(meetings));
  if (updates) dispatch(setUpdates(updates));
  if (tasks) dispatch(setTasks(tasks));
  if (tips) dispatch(setTips(tips));
  if (escalations) dispatch(setEscalations(escalations));
  if (notifications) dispatch(setNotifications(notifications.items));
  if (badges) dispatch(setBadges(badges));
};

/** First load after sign-in (and when the person presses refresh). */
export const refreshAll = (): AppThunk => async dispatch => {
  const [teams, workflows] = await Promise.all([attempt(() => teamsApi.list()), attempt(() => campaignsApi.list())]);
  if (teams) dispatch(setTeams(teams));
  if (workflows) dispatch(setWorkflows(workflows));
  await Promise.all([dispatch(refreshCollections('all')), dispatch(refreshLeads())]);
  dispatch(loadFinished());
};

/** What changes while the person works (replaces the old local scheduler): notifications, badges, meetings, leads. */
export const refreshTick = (): AppThunk => async dispatch => {
  await Promise.all([dispatch(refreshCollections(['notifications', 'meetings'])), dispatch(refreshLeads())]);
};
