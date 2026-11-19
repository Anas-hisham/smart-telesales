import type { Team } from '@/features/teams/types/teams.types';
import type { User } from '@/features/users/types/users.types';
import { get, put } from '@/shared/api/client';

export const teamsApi = {
  list: () => get<Team[]>('/teams'),
  moveAgent: (agentId: string, toTeamId: string) => put<{ agent: User; teams: Team[] }>(`/agents/${agentId}/team`, { toTeamId }),
  setManager: (teamId: string, managerId: string | null) => put<{ team: Team; changedAgents: User[] }>(`/teams/${teamId}/manager`, { managerId }),
  setQuality: (agentId: string, qualityId: string | null) => put<User>(`/agents/${agentId}/quality`, { qualityId }),
  qualityChoicesForTeam: (teamId: string) => get<User[]>(`/teams/${teamId}/quality-choices`),
  qualityChoicesForAgent: (agentId: string) => get<User[]>(`/agents/${agentId}/quality-choices`),
};
