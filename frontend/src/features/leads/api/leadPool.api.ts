import type { PoolPreview, PoolTake } from '@/features/leads/types/leadPool.types';
import { post } from '@/shared/api/client';

export const leadPoolApi = {
  preview: (text: string) => post<PoolPreview>('/lead-pool/preview', { text }),
  take: (leadIds: string[]) => post<PoolTake>('/lead-pool/take', { leadIds }),
};
