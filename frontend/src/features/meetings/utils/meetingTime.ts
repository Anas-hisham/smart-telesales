/** Meeting time helpers. */
import type { Meeting } from '@/features/meetings/types/meetings.types';

export const meetingStartMs = (meeting: Pick<Meeting, 'date' | 'time'>) => new Date(`${meeting.date}T${meeting.time}:00`).getTime();
