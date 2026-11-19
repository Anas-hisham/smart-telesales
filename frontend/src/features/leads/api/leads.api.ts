import type { CallLog, CallType } from '@/features/leads/types/callLog.types';
import type { ApiLead, ApiLeadDetail } from '@/features/leads/types/leads.types';
import type { Page } from '@/shared/api/api.types';
import { get, patch, post } from '@/shared/api/client';
import { generateUniqueId } from '@/shared/lib/uid';

export const leadsApi = {
  list: (queryParams: Record<string, string | number | boolean | undefined> = {}) => get<Page<ApiLead>>('/leads', queryParams),
  detail: (id: string) => get<ApiLeadDetail>(`/leads/${id}`),
  step: (id: string, order: number, kind: 'complete' | 'skip' | 'restore') => post<ApiLead>(`/leads/${id}/touch-points/${order}/${kind}`),
  logCall: (id: string, body: { type: CallType; reason?: string; description: string; touchPointOrder: number; completeTouchPoint: boolean }) =>
    post<{ lead: ApiLead; callLog: CallLog }>(`/leads/${id}/calls`, body, { idempotencyKey: generateUniqueId() }),
  editCall: (id: string, logId: string, body: { type: CallType; description: string }) => patch<{ lead: ApiLead; callLog: CallLog }>(`/leads/${id}/calls/${logId}`, body),
  stop: (id: string) => post<ApiLead>(`/leads/${id}/stop`),
  resume: (id: string) => post<ApiLead>(`/leads/${id}/resume`),
  remove: (id: string) => post<{ id: string }>(`/leads/${id}/remove`),
  transfer: (id: string, newAgentId: string) => post<ApiLead>(`/leads/${id}/transfer`, { newAgentId }),
};
