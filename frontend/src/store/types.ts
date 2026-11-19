import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import type { SessionStatus } from '@/features/auth/types/auth.types';
import type { Escalation } from '@/features/escalations/types/escalations.types';
import type { Lead } from '@/features/leads/types/leads.types';
import type { Meeting } from '@/features/meetings/types/meetings.types';
import type { Badges } from '@/features/notifications/types/notifications.types';
import type { Notification } from '@/features/notifications/types/notifications.types';
import type { Task } from '@/features/tasks/types/tasks.types';
import type { TeamUpdate } from '@/features/team-updates/types/teamUpdates.types';
import type { Team } from '@/features/teams/types/teams.types';
import type { Tip } from '@/features/tips/types/tips.types';
import type { User } from '@/features/users/types/users.types';
import type { Workflow } from '@/features/campaigns/types/campaigns.types';
import type { RootState } from '@/store/rootReducer';

/** An async action (thunk) of the app. */
export type AppThunk<R = void> = ThunkAction<Promise<R>, RootState, unknown, UnknownAction>;

/**
 * The whole app data in one object (what `useStore()` returns as `state`).
 * It is a COPY of what the server sent: the database is the source of truth. Nothing is saved in the browser.
 */
export interface AppState {
  /** booting = checking a saved login, anonymous = show the login page, ready = signed in */
  session: SessionStatus;
  /** true until the first full load after sign-in has finished */
  loading: boolean;
  currentUserId: string;
  users: User[];
  teams: Team[];
  workflows: Workflow[];
  /** Agents only: the leads of the signed-in agent (other roles read their lead lists from the API on the page). */
  leads: Lead[];
  meetings: Meeting[];
  updates: TeamUpdate[];
  tasks: Task[];
  notifications: Notification[];
  tips: Tip[];
  escalations: Escalation[];
  /** The numbers shown next to the menu items (computed by the server). */
  badges: Badges;
}
