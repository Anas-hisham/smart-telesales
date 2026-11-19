import { useEffect, useState } from 'react';
import { analyticsApi } from '@/features/analytics/api/analytics.api';
import type { AnalyticsReport, AnalyticsRow, DateRange, GroupRow, PeriodPreset } from '@/features/analytics/types/analytics.types';
import { errorText } from '@/shared/api/client';

/** The server sends rates as fractions (0.4553); the screen shows percents with one decimal (45.5). */
export const toPercent = (ratio: number) => Math.round(ratio * 1000) / 10;

export const groupRow = (row: AnalyticsRow): GroupRow => ({
  ...row, answerRate: toPercent(row.answerRate), reachRate: toPercent(row.reachRate), conversion: toPercent(row.conversion), reachToSale: toPercent(row.reachToSale),
});

/** GET /analytics: the server counts everything for the signed-in person's scope (own numbers, own team, or own teams). */
export function useAnalytics(preset: PeriodPreset, custom: DateRange, campaign: string) {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    const timeoutId = setTimeout(() => {       // a moment after the date inputs change
      analyticsApi.report({
        preset, campaign: campaign === 'all' ? undefined : campaign,
        ...(preset === 'custom' ? { from: custom.from || custom.to, to: custom.to || custom.from } : {}),
      })
        .then(loadedReport => { if (!stale) { setReport(loadedReport); setError(''); } })
        .catch(caughtError => { if (!stale) setError(errorText(caughtError)); })
        .finally(() => { if (!stale) setLoading(false); });
    }, 200);
    return () => { stale = true; clearTimeout(timeoutId); };
  }, [preset, custom.from, custom.to, campaign]);

  return { report, error, loading };
}
