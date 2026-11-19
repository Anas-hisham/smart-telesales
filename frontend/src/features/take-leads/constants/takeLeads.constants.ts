import { LEAD_RETOUCH_LOCK_DAYS } from '@/features/leads/constants/leads.constants';
import type { PoolStatus } from '@/features/leads/types/leadPool.types';
import { MAX_ROWS_PER_IMPORT } from '@/features/leads/schema/leadCode.schema';

/** What each answer of the server means, in words. */
export const CLAIM_STATUS_TEXT: Record<PoolStatus, string> = {
  ready: 'Ready to add',
  mine: 'Already in your leads',
  taken: 'Held by another agent',
  recently_worked: `It left another agent's queue less than ${LEAD_RETOUCH_LOCK_DAYS} days ago`,
  not_found: 'Not found in the pool',
  invalid: 'Not a valid lead ID',
  duplicate: 'Repeated in this list',
  over_limit: `Over the limit of ${MAX_ROWS_PER_IMPORT} leads at once`,
};
