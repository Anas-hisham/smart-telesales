/** Which work-queue bucket a lead belongs to: today / next / stop / finished. */
import type { TouchPoint } from '@/features/campaigns/types/campaigns.types';
import type { Lead } from '@/features/leads/types/leads.types';
import { findCurrentTouchPoint, isOpenTouchPoint } from '@/features/leads/utils/touchPoints';
import { endOfDay, startOfDay } from '@/shared/lib/dates';

// ---------------------------------------------------------------------------
// Work queue buckets:  today  /  next  /  stop
// ---------------------------------------------------------------------------
export type QueueBucket = 'today' | 'next' | 'stop' | 'finished';

/**
 *   stopped lead                                -> stop
 *   no open touch point left                    -> finished
 *   due today (or already overdue)              -> today
 *   due tomorrow or later                       -> next
 */
export function queueBucket(lead: Lead, now: number = Date.now()): QueueBucket {
  if (lead.stopped) return 'stop';
  const touchPoint = findCurrentTouchPoint(lead);
  if (!touchPoint || !isOpenTouchPoint(touchPoint)) return 'finished';
  if (!touchPoint.dueDate) return 'today';
  return new Date(touchPoint.dueDate).getTime() <= endOfDay(now).getTime() ? 'today' : 'next';
}

/** The moment a "next" lead moves into Today = the start of the day its touch point is due. */
export function becomesTodayAt(touchPoint: TouchPoint | undefined): number | null {
  if (!touchPoint?.dueDate) return null;
  return startOfDay(new Date(touchPoint.dueDate)).getTime();
}
