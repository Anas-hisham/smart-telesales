import { MAX_GAP_DAYS, MAX_TOUCH_POINTS } from '@/features/campaigns/constants/campaigns.constants';
import type { WorkflowDraft } from '@/features/campaigns/types/campaigns.types';
import { cleanCampaignCode } from '@/features/campaigns/utils/workflowDraft';

/** Returns a problem text, or '' when the draft can be saved. `otherCodes` = codes of the OTHER campaigns. */
export function validateWorkflowDraft(workflowDraft: WorkflowDraft, otherCodes: string[]): string {
  const code = cleanCampaignCode(workflowDraft.campaignCode);
  if (!code) return 'Campaign code is required';
  if (otherCodes.some(otherCode => otherCode.toUpperCase() === code)) return 'This campaign code already exists';
  if (!workflowDraft.name.trim()) return 'Campaign name is required';
  if (workflowDraft.steps.length === 0) return 'Add at least one touch point';
  if (workflowDraft.steps.length > MAX_TOUCH_POINTS) return `A campaign can have at most ${MAX_TOUCH_POINTS} touch points`;
  for (let index = 0; index < workflowDraft.steps.length; index++) {
    const step = workflowDraft.steps[index];
    if (step.type !== 'call' && step.type !== 'email') return `Touch point ${index + 1}: choose call or email`;
    if (!step.label.trim()) return `Touch point ${index + 1}: write a name for it`;
    if (!Number.isInteger(step.gapDays) || step.gapDays < 0 || step.gapDays > MAX_GAP_DAYS) return `Touch point ${index + 1}: days must be a whole number from 0 to ${MAX_GAP_DAYS}`;
  }
  return '';
}
