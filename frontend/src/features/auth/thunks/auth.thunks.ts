import { authApi } from '@/features/auth/api/auth.api';
import { sessionEnded, sessionReady } from '@/features/auth/slice/auth.slice';
import { refreshAll } from '@/features/workspace/thunks/workspace.thunks';
import { clearTokens, getRefreshToken, setTokens } from '@/shared/api/client';
import type { AppThunk } from '@/store/types';

export const login = (username: string, password: string): AppThunk => async dispatch => {
  const loginResponse = await authApi.login(username.trim(), password);          // errors go to the login form
  setTokens({ accessToken: loginResponse.accessToken, refreshToken: loginResponse.refreshToken });
  dispatch(sessionReady({ user: loginResponse.user }));
  await dispatch(refreshAll());
};

/** On page load: if a login is saved, restore the session. */
export const bootSession = (): AppThunk => async dispatch => {
  try {
    const currentUser = await authApi.me();
    dispatch(sessionReady({ user: currentUser.user, badges: currentUser.badges }));
    await dispatch(refreshAll());
  } catch {
    clearTokens();
    dispatch(sessionEnded());
  }
};

export const logout = (): AppThunk => async dispatch => {
  const refresh = getRefreshToken();
  try { await authApi.logout(refresh); } catch { /* the token may already be dead: leave anyway */ }
  clearTokens();
  dispatch(sessionEnded());
};
