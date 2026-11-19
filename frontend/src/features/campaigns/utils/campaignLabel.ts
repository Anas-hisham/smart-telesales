/** Display name of a campaign. */
import type { Workflow } from '@/features/campaigns/types/campaigns.types';

// ---------------------------------------------------------------------------
// Display names  ("Activation" instead of ACT-001, "1: CALL" instead of 1-call-ACT-001)
// ---------------------------------------------------------------------------
/** "Activation Campaign" -> "Activation". Falls back to the code when there is no workflow. */
export function campaignLabel(workflows: Workflow[], code: string): string {
  const workflow = workflows.find(candidateWorkflow => candidateWorkflow.campaignCode === code);
  return (workflow?.name ?? code).replace(/\s+campaign$/i, '').trim();
}
