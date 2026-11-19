import type { GroupRow } from '@/features/analytics/types/analytics.types';

/** Calls and their results per campaign / agent (no lead counts). */
export function GroupPerformanceTable({ rows, first }: { rows: GroupRow[]; first: string }) {
  const tableHeaderClass = 'px-3 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap';
  const tableCellClass = 'px-3 py-2.5 text-sm text-slate-700 whitespace-nowrap';
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-slate-100">
          <tr>
            <th className={tableHeaderClass}>{first}</th><th className={tableHeaderClass}>Calls</th>
            <th className={tableHeaderClass}>NVM</th><th className={tableHeaderClass}>LVM</th><th className={tableHeaderClass}>Discovery</th>
            <th className={tableHeaderClass}>Answer rate</th><th className={tableHeaderClass}>Reach rate</th><th className={tableHeaderClass}>Sales</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key} className="border-b border-slate-100 last:border-0">
              <td className={`${tableCellClass} font-medium text-slate-900`}>{row.label}</td>
              <td className={tableCellClass}>{row.calls}</td>
              <td className={tableCellClass}>{row.nvm}</td><td className={tableCellClass}>{row.lvm}</td><td className={tableCellClass}>{row.discovery}</td>
              <td className={tableCellClass}>{row.answerRate}%</td><td className={tableCellClass}>{row.reachRate}%</td><td className={tableCellClass}>{row.sales}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td className={tableCellClass} colSpan={8}>No data for this selection.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
