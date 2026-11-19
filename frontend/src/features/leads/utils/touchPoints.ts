/** Rules about touch points: which one is open, which one is current, when the next one is due. */
import type { TouchPoint } from '@/features/campaigns/types/campaigns.types';
import type { Lead } from '@/features/leads/types/leads.types';

/** A touch point still waiting for the agent (not done, not skipped). */
export const isOpenTouchPoint = (touchPoint: TouchPoint) => touchPoint.status === 'pending' || touchPoint.status === 'overdue';

/** The open touch point the lead is currently waiting on (undefined when the workflow is finished). */
export const findCurrentTouchPoint = (lead: Lead) => lead.touchPoints.find(touchPoint => touchPoint.order === lead.currentTouchPoint);

export function describeDueDate(touchPoint: TouchPoint | undefined): { label: string; tone: 'overdue' | 'today' | 'later' | 'none' } {
  if (!touchPoint || !touchPoint.dueDate) return { label: '', tone: 'none' };
  const due = new Date(touchPoint.dueDate);
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  if (due < startOfToday) {
    const days = Math.max(1, Math.round((startOfToday.getTime() - due.getTime()) / 86400000));
    return { label: `Overdue ${days}d`, tone: 'overdue' };
  }
  if (due <= endOfToday) return { label: 'Due today', tone: 'today' };
  const days = Math.ceil((due.getTime() - endOfToday.getTime()) / 86400000);
  return { label: `Due in ${days}d`, tone: 'later' };
}

/** When the agent last touched this lead (latest completed touch point of the current round). */
export function lastTouchTimestamp(lead: Lead): number | null {
  let best: number | null = null;
  for (const touchPoint of lead.touchPoints) {
    if (touchPoint.status !== 'completed' || !touchPoint.completedAt) continue;
    const timerId = new Date(touchPoint.completedAt).getTime();
    if (best === null || timerId > best) best = timerId;
  }
  return best;
}

/** "1: CALL" / "2: EMAIL" */
export const stepLabel = (order: number, type: string) => `${order + 1}: ${type.toUpperCase()}`;
