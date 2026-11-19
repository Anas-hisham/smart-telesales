import { useEffect } from 'react';
import { loadLeadDetail } from '@/features/leads/thunks/leads.thunks';
import type { Lead } from '@/features/leads/types/leads.types';
import { useAppDispatch } from '@/store/hooks';

/**
 * The lead lists do not carry the call logs and the activity history (they would make every list very heavy).
 * When a lead is opened, load them (GET /leads/:id); load again when something changed on the lead.
 */
export function useLeadDetail(lead: Lead | null | undefined) {
  const dispatch = useAppDispatch();
  const id = lead?.id;
  const stamp = `${lead?.lastActivityAt ?? ''}|${lead?.callCount ?? ''}|${lead?.currentTouchPoint ?? ''}|${lead?.stopped ?? ''}`;
  useEffect(() => { if (id) void dispatch(loadLeadDetail(id)); }, [id, stamp, dispatch]);
}
