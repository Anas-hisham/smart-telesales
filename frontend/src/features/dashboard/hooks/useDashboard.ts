import { useCallback, useEffect, useState } from 'react';
import { dashboardApi } from '@/features/dashboard/api/dashboard.api';
import type { DashboardDto } from '@/features/dashboard/types/dashboard.types';
import { errorText } from '@/shared/api/client';

/** The numbers of the dashboard come ready-made from GET /dashboard (the server counts the calls of "today" in Cairo time). */
export function useDashboard() {
  const [data, setData] = useState<DashboardDto | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try { setData(await dashboardApi.get()); setError(''); }
    catch (caughtError) { setError(errorText(caughtError)); }
  }, []);

  useEffect(() => {
    void reload();
    const intervalId = setInterval(() => { if (document.visibilityState === 'visible') void reload(); }, 30_000);
    return () => clearInterval(intervalId);
  }, [reload]);

  return { data, error, reload };
}
