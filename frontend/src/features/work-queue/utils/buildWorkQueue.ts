/** Turns the agent's leads into: campaign -> Today / Next / Stop -> touch point step -> category. */
import type { TouchPointType, Workflow } from '@/features/campaigns/types/campaigns.types';
import { campaignLabel } from '@/features/campaigns/utils/campaignLabel';
import type { Lead } from '@/features/leads/types/leads.types';
import { queueCategory, type QueueCategory } from '@/features/leads/utils/callClassification';
import { queueBucket } from '@/features/leads/utils/leadQueue';
import { findCurrentTouchPoint } from '@/features/leads/utils/touchPoints';
import { QUEUE_CATEGORY_ORDER } from '@/features/work-queue/constants/queueStyles';

export interface TouchPointStepGroup {
  order: number;
  type: TouchPointType;
  label: string;
  byCategory: Record<QueueCategory, Lead[]>;
  total: number;
}

export interface CampaignQueue {
  code: string;
  name: string;            // "Activation" - what the agent sees instead of ACT-001
  today: TouchPointStepGroup[];
  next: TouchPointStepGroup[];
  todayCount: number;
  nextCount: number;
  stopped: Lead[];         // leads whose workflow the agent stopped
  finished: Lead[];        // leads that finished every touch point
  total: number;
}

const createEmptyLeadsByCategory = (): Record<QueueCategory, Lead[]> => ({ new: [], discovery: [], lvm: [], nvm: [] });

/**
 * Campaign -> Today / Next / Stop.
 *   Today = touch point is due today (or overdue)     Next = due tomorrow or later     Stop = stopped by the agent
 * Inside Today / Next the leads are grouped by touch point step (1: CALL, 2: EMAIL ...) and then by category.
 */
export function buildWorkQueue(leads: Lead[], workflows: Workflow[], now: number): CampaignQueue[] {
  const byCampaign = new Map<string, Lead[]>();
  for (const lead of leads) {
    if (!byCampaign.has(lead.campaignCode)) byCampaign.set(lead.campaignCode, []);
    byCampaign.get(lead.campaignCode)!.push(lead);
  }

  return [...byCampaign.entries()].map(([code, campaignLeads]) => {
    const maps = { today: new Map<number, TouchPointStepGroup>(), next: new Map<number, TouchPointStepGroup>() };
    const stopped: Lead[] = [];
    const finished: Lead[] = [];
    let todayCount = 0, nextCount = 0;

    for (const lead of campaignLeads) {
      const bucket = queueBucket(lead, now);
      if (bucket === 'stop') { stopped.push(lead); continue; }
      if (bucket === 'finished') { finished.push(lead); continue; }
      const touchPoint = findCurrentTouchPoint(lead)!;
      const stepMap = maps[bucket];
      if (!stepMap.has(touchPoint.order)) stepMap.set(touchPoint.order, { order: touchPoint.order, type: touchPoint.type, label: touchPoint.label, byCategory: createEmptyLeadsByCategory(), total: 0 });
      const step = stepMap.get(touchPoint.order)!;
      step.byCategory[queueCategory(lead)].push(lead);
      step.total++;
      if (bucket === 'today') todayCount++; else nextCount++;
    }

    // inside a step: the lead that has waited longest comes first
    const dueTimeOfLead = (lead: Lead) => new Date(findCurrentTouchPoint(lead)?.dueDate ?? 0).getTime();
    const sortStepGroupsAndLeads = (stepGroupsByNumber: Map<number, TouchPointStepGroup>) => [...stepGroupsByNumber.values()]
      .sort((stepGroupA, stepGroupB) => stepGroupA.order - stepGroupB.order)
      .map(stepGroup => { QUEUE_CATEGORY_ORDER.forEach(category => stepGroup.byCategory[category].sort((leadA, leadB) => dueTimeOfLead(leadA) - dueTimeOfLead(leadB))); return stepGroup; });

    return {
      code, name: campaignLabel(workflows, code),
      today: sortStepGroupsAndLeads(maps.today), next: sortStepGroupsAndLeads(maps.next),
      todayCount, nextCount, stopped, finished, total: campaignLeads.length,
    };
  }).sort((campaignA, campaignB) => campaignA.name.localeCompare(campaignB.name));
}
