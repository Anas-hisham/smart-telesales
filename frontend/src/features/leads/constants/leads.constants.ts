import type { CallReason } from '@/features/leads/types/callLog.types';

// ---------------------------------------------------------------------------
// Rules agreed with the project owner
// ---------------------------------------------------------------------------
/** A lead that makes no progress (same touch point, or stopped) for this many CALENDAR days leaves the agent's queue. */
export const LEAD_EXPIRY_DAYS = 15;

/**
 * A lead that left an agent's queue (steps finished, 15 days without progress, or removed by the agent) cannot be taken
 * by ANOTHER agent until this many days have passed since it left. The agent who had it may take it again at once.
 */
export const LEAD_RETOUCH_LOCK_DAYS = 15;

/** The outcome reasons an agent can pick when logging a call. */
export const REASON_LABEL: Record<CallReason, string> = {
  interested: 'Interested', callback: 'Call back later', price: 'Price', timing: 'Timing',
  not_interested: 'Not interested', wrong_contact: 'Wrong contact', no_answer: 'No answer', voicemail: 'Voicemail / third person', other: 'Other',
};
