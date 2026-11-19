import type { Escalation } from '@/features/escalations/types/escalations.types';
import type { User } from '@/features/users/types/users.types';
import { get, post } from '@/shared/api/client';

export const escalationsApi = {
  subjects: () => get<User[]>('/escalations/subjects'),
  recipients: (aboutId: string) => get<{ user: User; reason: string }[]>('/escalations/recipients', { aboutId }),
  list: () => get<Escalation[]>('/escalations'),
  create: (body: { aboutId: string; recipientId: string; title: string; details: string }) => post<Escalation>('/escalations', body),
  forward: (id: string, body: { toId: string; note?: string }) => post<Escalation>(`/escalations/${id}/forward`, body),
  resolve: (id: string, body: { note?: string }) => post<Escalation>(`/escalations/${id}/resolve`, body),
};
