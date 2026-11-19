import { meetingsApi } from '@/features/meetings/api/meetings.api';
import { meetingsUpserted } from '@/features/meetings/slice/meetings.slice';
import type { MeetingInput } from '@/features/meetings/types/meetings.types';
import { attempt } from '@/shared/api/attempt';
import type { AppThunk } from '@/store/types';

export const createMeeting = (meetingInput: MeetingInput): AppThunk<boolean> => async dispatch => {
  const meeting = await attempt(() => meetingsApi.create(meetingInput));
  if (meeting) dispatch(meetingsUpserted([meeting]));
  return !!meeting;
};
export const updateMeeting = (params: { meetingId: string; updates: Record<string, unknown> }): AppThunk<boolean> => async dispatch => {
  const meeting = await attempt(() => meetingsApi.update(params.meetingId, params.updates));
  if (meeting) dispatch(meetingsUpserted([meeting]));
  return !!meeting;
};
/** The old meeting becomes "rescheduled" and a new one is created (one step on the server). */
export const rescheduleMeeting = (params: { meetingId: string; date: string; time: string; duration?: number; notes?: string }): AppThunk<boolean> => async dispatch => {
  const { meetingId, ...body } = params;
  const result = await attempt(() => meetingsApi.reschedule(meetingId, body));
  if (result) dispatch(meetingsUpserted([result.old, result.new]));
  return !!result;
};
