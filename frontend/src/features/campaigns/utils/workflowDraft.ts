/**
 * Creating / editing a campaign (Admin).
 * A touch point is described to people as "wait N days after the previous step" (0 = right away).
 * The stored workflow keeps the running total (dayOffset: 0, 1, 2, 4 ...), which is what the server uses.
 */
import type { DraftStep, TouchPointTemplate } from '@/features/campaigns/types/campaigns.types';

/** "act 001" -> "ACT-001": upper case, letters / digits / dashes only. */
export const cleanCampaignCode = (code: string) =>
  code.trim().toUpperCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');

/** The stored template -> steps with the gap from the previous step (for the editor). */
export function draftStepsFromTemplates(touchPointTemplates: TouchPointTemplate[]): DraftStep[] {
  const sorted = [...touchPointTemplates].sort((touchPointTemplateA, touchPointTemplateB) => touchPointTemplateA.order - touchPointTemplateB.order);
  return sorted.map((touchPointTemplate, index) => ({ type: touchPointTemplate.type, label: touchPointTemplate.label, gapDays: index === 0 ? 0 : Math.max(0, touchPointTemplate.dayOffset - sorted[index - 1].dayOffset) }));
}

/** Plain-words timing of one step, e.g. "Right away", "1 day after the previous step". */
export function describeGap(index: number, gapDays: number): string {
  if (index === 0) return 'When the agent takes the lead';
  if (gapDays === 0) return 'Right after the previous step';
  return `${gapDays} day${gapDays === 1 ? '' : 's'} after the previous step`;
}
