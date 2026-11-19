import type { TouchPoint } from '@/features/campaigns/types/campaigns.types';
import type { Lead } from '@/features/leads/types/leads.types';

/** Everything a row of the work queue can ask the page to do (the page owns the modals and the store calls). */
export interface QueueHandlers {
  onMarkComplete: (lead: Lead, touchPoint: TouchPoint) => void;   // opens the call-log or email modal
  onSkip: (lead: Lead, touchPoint: TouchPoint) => void;           // asks for confirmation, then skips the touch point
  onDetails: (lead: Lead) => void;                        // opens the lead drawer
  onResume: (leadId: string) => void;                     // resumes a stopped workflow
  onRequestRemove: (lead: Lead) => void;                  // asks for confirmation, then removes the lead from my queue
}
