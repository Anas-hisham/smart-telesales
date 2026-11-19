import type { DashboardDto } from '@/features/dashboard/types/dashboard.types';
import { get } from '@/shared/api/client';

export const dashboardApi = { get: () => get<DashboardDto>('/dashboard') };
