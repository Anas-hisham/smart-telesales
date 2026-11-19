import type { TeamUpdate } from '@/features/team-updates/types/teamUpdates.types';
import { get, post } from '@/shared/api/client';

export const teamUpdatesApi = {
  list: () => get<TeamUpdate[]>('/updates'),
  create: (body: { audience: string; title: string; content: string }) => post<TeamUpdate>('/updates', body),
  seen: () => post<void>('/updates/seen'),
  acknowledge: (id: string) => post<TeamUpdate>(`/updates/${id}/acknowledge`),
};
