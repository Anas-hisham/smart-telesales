import type { Workflow } from '@/features/campaigns/types/campaigns.types';
import { del, get, post, put } from '@/shared/api/client';

/** Campaigns are called "workflows" by the server. */
export const campaignsApi = {
  list: () => get<Workflow[]>('/workflows'),
  create: (body: unknown) => post<Workflow>('/workflows', body),
  update: (code: string, body: unknown) => put<Workflow>(`/workflows/${encodeURIComponent(code)}`, body),
  remove: (code: string) => del<void>(`/workflows/${encodeURIComponent(code)}`),
};
