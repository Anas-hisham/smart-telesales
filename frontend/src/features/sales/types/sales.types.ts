import type { Team } from '@/features/teams/types/teams.types';
import type { User } from '@/features/users/types/users.types';

/** Sales recorded by the Quality role. */
// ---------------------------------------------------------------------------
// Sales (recorded by the Quality role)
// ---------------------------------------------------------------------------
export type SaleType = 'BP' | 'PPI' | 'MUA' | 'ATEP' | 'Activation' | 'Retention' | 'Transition';

export interface Sale {
  id: string;
  agentId: string;
  leadId: string;         // REQUIRED: the lead is the identity of a sale (company names can repeat). Campaign is derived from it.
  leadName: string;       // snapshot of the company name at the time of the sale (display only)
  saleType: SaleType;
  date: string;           // YYYY-MM-DD, the day the sale happened
  createdBy: string;      // the quality user who recorded it
  createdAt: string;
  agentName?: string;
  campaignCode?: string;
}

export interface SalesOverview {
  month: string;
  groups: { team: Team; leader: User | null; total: number; target: number; agents: { agent: User; count: number; byType: Record<SaleType, number> }[] }[];
  topAgents: { agent: User; teamId?: string; sales: number; discovery: number; lvm: number }[];
  scope: { agentIds: string[]; total: number; target: number; byType: Record<SaleType, number> };
  sales: (Sale & { canDelete?: boolean; canSeeDetails?: boolean })[];
}

export interface SaleDetails { sales: { sale: Sale; lead: { id: string; companyName: string; contactName: string; campaignCode: string; leadCode: string } }[] }

export interface AgentRank {
  agent: User;
  sales: number;
  discovery: number;   // used only to break ties
  lvm: number;         // used only to break ties
}

/** Types used only by the Sales screen. */
export type SortDirection = 'desc' | 'asc';
