export interface AnalyticsRow {
  key: string; label: string; calls: number; nvm: number; lvm: number; discovery: number; answerRate: number; reachRate: number;
  leads: number; reached: number; sold: number; sales: number; conversion: number; reachToSale: number; callsPerLead: number;
}

export interface AnalyticsReport {
  range: { from: string; to: string };
  calls: { calls: number; nvm: number; lvm: number; discovery: number; answerRate: number; reachRate: number };
  funnel: { leads: number; contacted: number; reached: number; meetings: number; sold: number };
  campaigns: AnalyticsRow[];
  agents: AnalyticsRow[];
  hours: { hour: number; calls: number; answered: number; reached: number; reachRate: number }[];
  reasons: { reason: string; label: string; count: number; share: number }[];
  salesCount: number;
  salesTarget: number;
  dataQuality: { id: string; level: 'warn' | 'info'; text: string }[];
}

export type PeriodPreset = 'today' | 'week' | 'month' | 'custom';

/** Both ends are local days (YYYY-MM-DD) and both are included. */
export interface DateRange { from: string; to: string }

export interface CallStats { calls: number; nvm: number; lvm: number; discovery: number; answerRate: number; reachRate: number }

export interface GroupRow extends CallStats {
  key: string; label: string; leads: number; reached: number; sold: number; sales: number;
  conversion: number;       // sold leads / leads
  reachToSale: number;      // sold leads / reached leads
  callsPerLead: number;
}
