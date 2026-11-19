import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SessionStatus } from '@/features/auth/types/auth.types';
import type { Badges } from '@/features/notifications/types/notifications.types';
import type { User } from '@/features/users/types/users.types';
import { hasTokens } from '@/shared/api/client';

interface AuthState {
  session: SessionStatus;
  /** true until the first full load after sign-in has finished */
  loading: boolean;
  currentUserId: string;
}

const initialState = (): AuthState => ({
  session: hasTokens() ? 'booting' : 'anonymous',
  loading: false,
  currentUserId: '',
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** Signed in. (The users and notifications slices also listen to this action.) */
    sessionReady(state, action: PayloadAction<{ user: User; badges?: Badges }>) {
      state.session = 'ready';
      state.loading = true;
      state.currentUserId = action.payload.user.id;
    },
    /** Signed out. (Every slice listens to this action and empties itself.) */
    sessionEnded() { return { ...initialState(), session: 'anonymous' as const }; },
    loadFinished(state) { state.loading = false; },
  },
});

export const { sessionReady, sessionEnded, loadFinished } = authSlice.actions;
export default authSlice.reducer;
