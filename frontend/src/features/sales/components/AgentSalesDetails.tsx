import { useEffect, useState } from 'react';
import { salesApi } from '@/features/sales/api/sales.api';
import { saleTypeConfig } from '@/features/sales/constants/sales.constants';
import type { SaleDetails } from '@/features/sales/types/sales.types';
import { errorText } from '@/shared/api/client';

/** An agent's sales for the month, grouped by lead (one lead can bring more than one sale). Loaded when "More details" opens. */
export function AgentSalesDetails({ agentId, month }: { agentId: string; month: string }) {
  const [data, setData] = useState<SaleDetails | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stale = false;
    setData(null); setError('');
    salesApi.agentDetails(agentId, month).then(saleDetails => { if (!stale) setData(saleDetails); }).catch(caughtError => { if (!stale) setError(errorText(caughtError)); });
    return () => { stale = true; };
  }, [agentId, month]);

  if (error) return <p className="text-xs text-rose-600" role="alert">{error}</p>;
  if (!data) return <p className="text-xs text-slate-500" role="status">Loading…</p>;
  if (data.sales.length === 0) return <p className="text-xs text-slate-500">No sales this month.</p>;

  const byLead = new Map<string, SaleDetails['sales']>();
  for (const row of [...data.sales].sort((saleA, saleB) => saleB.sale.date.localeCompare(saleA.sale.date) || saleB.sale.createdAt.localeCompare(saleA.sale.createdAt))) {
    byLead.set(row.lead.id, [...(byLead.get(row.lead.id) ?? []), row]);
  }

  return (
    <ul className="space-y-2">
      {[...byLead.entries()].map(([leadId, rows]) => {
        const lead = rows[0].lead;
        return (
          <li key={leadId} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">{lead.companyName}</div>
                <div className="text-xs text-slate-600">{lead.leadCode} · {lead.campaignCode}</div>
              </div>
              {rows.length > 1 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 shrink-0">{rows.length} sales</span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {rows.map(({ sale: sale }) => (
                <span key={sale.id} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${saleTypeConfig(sale.saleType).chip}`}>{saleTypeConfig(sale.saleType).label}</span>
                  {new Date(`${sale.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
