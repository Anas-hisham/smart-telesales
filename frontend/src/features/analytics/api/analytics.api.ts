import type { AnalyticsReport } from '@/features/analytics/types/analytics.types';
import { get } from '@/shared/api/client';

export const analyticsApi = {
  report: (queryParams: { preset: 'today' | 'week' | 'month' | 'custom'; from?: string; to?: string; campaign?: string }) => get<AnalyticsReport>('/analytics', queryParams),
};
