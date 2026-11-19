import { configureStore } from '@reduxjs/toolkit';
import { sessionEnded } from '@/features/auth/slice/auth.slice';
import { setSessionLostHandler } from '@/shared/api/client';
import { rootReducer } from '@/store/rootReducer';

export const store = configureStore({
  reducer: rootReducer,
});

// when the server says the login can no longer be renewed, go back to the login page
setSessionLostHandler(() => store.dispatch(sessionEnded()));

export type AppDispatch = typeof store.dispatch;
export type { RootState } from '@/store/rootReducer';
