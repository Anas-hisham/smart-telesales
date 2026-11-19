/** The 15-day rule: when does a lead without progress leave the agent's queue. */
import { LEAD_EXPIRY_DAYS } from '@/features/leads/constants/leads.constants';
import type { Lead } from '@/features/leads/types/leads.types';

// ---------------------------------------------------------------------------
// 15-day rule
// ---------------------------------------------------------------------------
/** The moment the 15 days are counted from: the latest of assignment, last completed touch point, stop/resume. */
export function expiryReferenceMs(lead: Lead): number {
  const stamps = [lead.assignedAt, lead.lastActivityAt]
    .filter((value): value is string => !!value).map(value => new Date(value).getTime());
  for (const touchPoint of lead.touchPoints) if (touchPoint.status === 'completed' && touchPoint.completedAt) stamps.push(new Date(touchPoint.completedAt).getTime());
  return Math.max(...stamps.filter(stamp => !isNaN(stamp)));
}

/** Whole days left before the lead leaves the queue (0 = today). */
export const daysUntilExpiry = (lead: Lead, now: number = Date.now()) =>
  Math.max(0, Math.ceil((expiryReferenceMs(lead) + LEAD_EXPIRY_DAYS * 86400000 - now) / 86400000));
