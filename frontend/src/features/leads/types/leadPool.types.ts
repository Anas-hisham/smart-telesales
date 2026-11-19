import type { ApiLead } from '@/features/leads/types/leads.types';

export type PoolStatus = 'ready' | 'mine' | 'taken' | 'recently_worked' | 'not_found' | 'invalid' | 'duplicate' | 'over_limit';

export interface PoolPreviewRow { line: number; code: string; status: PoolStatus; leadId?: string; companyName?: string; holderName?: string; daysLeft?: number }

export interface PoolPreview { results: PoolPreviewRow[]; summary: Partial<Record<PoolStatus, number>> }

export interface PoolTake { taken: ApiLead[]; skipped: { leadId?: string; code?: string; status?: string; reason?: string }[] }
