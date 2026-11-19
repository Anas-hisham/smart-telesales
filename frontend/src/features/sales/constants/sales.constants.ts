/** The list of sale types and the monthly sales target. */
import type { SaleType } from '@/features/sales/types/sales.types';

export const SALE_TYPES: { value: SaleType; label: string; chip: string }[] = [
  { value: 'BP', label: 'BP', chip: 'bg-emerald-100 text-emerald-700' },
  { value: 'PPI', label: 'PPI', chip: 'bg-violet-100 text-violet-700' },
  { value: 'MUA', label: 'MUA', chip: 'bg-blue-100 text-blue-700' },
  { value: 'ATEP', label: 'ATEP', chip: 'bg-amber-100 text-amber-700' },
  { value: 'Activation', label: 'Activation', chip: 'bg-cyan-100 text-cyan-700' },
  { value: 'Retention', label: 'Retention', chip: 'bg-rose-100 text-rose-700' },
  { value: 'Transition', label: 'Transition', chip: 'bg-slate-100 text-slate-700' },
];

export const saleTypeConfig = (saleType: SaleType) => SALE_TYPES.find(saleTypeOption => saleTypeOption.value === saleType) ?? SALE_TYPES[0];

/** Monthly sales target for ONE agent. Team Leader = agents x this. Operation Manager = sum of their teams. */
export const AGENT_SALES_TARGET = 28;
