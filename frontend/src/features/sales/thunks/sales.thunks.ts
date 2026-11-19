import { salesApi } from '@/features/sales/api/sales.api';
import type { SaleType } from '@/features/sales/types/sales.types';
import { attempt } from '@/shared/api/attempt';
import type { AppThunk } from '@/store/types';

/** Returns the server warnings (e.g. DUPLICATE_SALE) or null when it failed. */
export const recordSale = (saleInput: { agentId: string; leadId: string; saleType: SaleType; date?: string }): AppThunk<string[] | null> => async () => {
  const result = await attempt(() => salesApi.create(saleInput));
  return result ? result.warnings ?? [] : null;
};
export const deleteSale = (id: string): AppThunk<boolean> => async () => !!(await attempt(async () => { await salesApi.remove(id); return true; }));
