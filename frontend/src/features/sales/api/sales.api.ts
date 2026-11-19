import type { Sale, SaleDetails, SalesOverview, SaleType } from '@/features/sales/types/sales.types';
import { del, get, post } from '@/shared/api/client';
import { generateUniqueId } from '@/shared/lib/uid';

export const salesApi = {
  overview: (month?: string) => get<SalesOverview>('/sales/overview', { month }),
  agentDetails: (agentId: string, month?: string) => get<SaleDetails>(`/sales/agents/${agentId}/details`, { month }),
  create: (body: { agentId: string; leadId: string; saleType: SaleType; date?: string }) => post<{ sale: Sale; warnings?: string[] }>('/sales', body, { idempotencyKey: generateUniqueId() }),
  remove: (id: string) => del<void>(`/sales/${id}`),
};
