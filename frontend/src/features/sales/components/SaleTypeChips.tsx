import { SALE_TYPES } from '@/features/sales/constants/sales.constants';
import type { SaleType } from '@/features/sales/types/sales.types';

/** The number of sales of each type (the server already counted them). */
export function SaleTypeChips({ counts }: { counts: Partial<Record<SaleType, number>> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SALE_TYPES.map(saleTypeOption => {
        const count = counts[saleTypeOption.value] ?? 0;
        return (
          <span key={saleTypeOption.value} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${count > 0 ? saleTypeOption.chip : 'bg-slate-50 text-slate-500'}`}>
            {saleTypeOption.label} {count}
          </span>
        );
      })}
    </div>
  );
}
