import type { Tip, TipRecipients } from '@/features/tips/types/tips.types';
import { get, post } from '@/shared/api/client';

export const tipsApi = {
  list: () => get<Tip[]>('/tips'),
  recipients: () => get<TipRecipients[]>('/tips/recipients'),
  create: (body: { agentIds: string[]; title: string; content: string }) => post<{ created: Tip[]; skipped: unknown[] }>('/tips', body),
  seen: () => post<void>('/tips/seen'),
  acknowledge: (id: string) => post<Tip>(`/tips/${id}/acknowledge`),
};
