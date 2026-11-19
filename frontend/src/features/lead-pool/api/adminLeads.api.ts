import type { AdminLeadPage, AdminLeadRow, ImportParse } from '@/features/lead-pool/types/adminLeads.types';
import { get, post } from '@/shared/api/client';

export const adminLeadsApi = {
  list: (queryParams: { q?: string; filter?: 'all' | 'pool' | 'assigned'; page?: number; pageSize?: number }) => get<AdminLeadPage>('/admin/leads', queryParams),
  addOne: (body: Record<string, unknown>) => post<AdminLeadRow>('/admin/leads', body),
  importPreview: (campaignCode: string, text: string) => post<ImportParse>('/admin/leads/import/preview', { campaignCode, text }),
  import: (campaignCode: string, text: string) => post<{ created: number; rejected: ImportParse['rejected'] }>('/admin/leads/import', { campaignCode, text }),
  remove: (ids: string[]) => post<{ deleted: string[]; skipped: { id: string; reason: string }[] }>('/admin/leads/delete', { ids }),
};
