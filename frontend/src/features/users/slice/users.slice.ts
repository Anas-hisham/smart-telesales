import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { sessionEnded, sessionReady } from '@/features/auth/slice/auth.slice';
import type { User } from '@/features/users/types/users.types';
import { upsertById } from '@/shared/lib/upsertById';

const usersSlice = createSlice({
  name: 'users',
  initialState: [] as User[],
  reducers: {
    setUsers: (_state, action: PayloadAction<User[]>) => action.payload,
    usersUpserted(state, action: PayloadAction<User[]>) { upsertById(state, action.payload); },
  },
  extraReducers: builder => {
    builder
      .addCase(sessionReady, (state, action) => [action.payload.user, ...state.filter(user => user.id !== action.payload.user.id)])
      .addCase(sessionEnded, () => []);
  },
});

export const { setUsers, usersUpserted } = usersSlice.actions;
export default usersSlice.reducer;
