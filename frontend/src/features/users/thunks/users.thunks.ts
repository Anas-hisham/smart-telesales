import { loadTeams } from '@/features/teams/thunks/teams.thunks';
import { usersApi } from '@/features/users/api/users.api';
import type { NewUserInput } from '@/features/users/types/users.types';
import { usernameFromEmail } from '@/features/users/utils/users.utils';
import { refreshCollections } from '@/features/workspace/thunks/workspace.thunks';
import { attempt } from '@/shared/api/attempt';
import type { AppThunk } from '@/store/types';

export const createUser = (input: NewUserInput): AppThunk<boolean> => async (dispatch, getState) => {
  const { users } = getState();
  const username = usernameFromEmail(users, input.email).slice(0, 32).padEnd(3, '0');
  const base = { username, password: input.password, name: input.name.trim(), email: input.email.trim(), role: input.role };
  const body =
    input.role === 'operation_manager' || input.role === 'quality' ? { ...base, lob: input.lob }
    : input.role === 'team_leader' ? { ...base, teamName: input.teamName.trim(), managerId: input.managerId || null }
    : { ...base, teamId: input.teamId, qualityId: input.qualityId || null, dailyCallTarget: input.dailyCallTarget };
  const user = await attempt(() => usersApi.create(body));
  if (!user) return false;
  await Promise.all([dispatch(refreshCollections(['users'])), dispatch(loadTeams())]);
  return true;
};
