import type { Meeting, MeetingInput, MeetingOptions } from '@/features/meetings/types/meetings.types';
import { get, patch, post } from '@/shared/api/client';

export const meetingsApi = {
  options: () => get<MeetingOptions>('/meetings/options'),
  list: (queryParams: { from?: string; to?: string } = {}) => get<Meeting[]>('/meetings', queryParams),
  create: (body: MeetingInput) => post<Meeting>('/meetings', body),
  update: (id: string, body: Record<string, unknown>) => patch<Meeting>(`/meetings/${id}`, body),
  reschedule: (id: string, body: { date: string; time: string; duration?: number; notes?: string }) => post<{ old: Meeting; new: Meeting }>(`/meetings/${id}/reschedule`, body),
};
