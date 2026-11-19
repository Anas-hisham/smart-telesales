import type { Lead } from '@/features/leads/types/leads.types';
import type { Page } from '@/shared/api/api.types';

/** One row of the Admin lead list (GET /admin/leads). */
export interface AdminLeadRow {
  id: string; leadCode: string; campaignCode: string; companyName: string; contactName: string; phone?: string; email: string;
  agentId: string | null; agentName: string | null; inPool: boolean; hasSale: boolean; status: Lead['status']; assignedAt?: string; round: number;
}

export interface AdminLeadPage extends Page<AdminLeadRow> { poolCount: number; assignedCount: number }

export interface ImportRow { line?: number; leadCode: string; companyName: string; contactName: string; email: string; phone?: string }

export interface ImportRejected { line?: number; leadCode?: string; reason: string; raw?: string }

export interface ImportParse { accepted: ImportRow[]; rejected: ImportRejected[] }
