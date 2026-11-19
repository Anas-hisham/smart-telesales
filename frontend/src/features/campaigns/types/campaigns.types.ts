/** A campaign workflow (the template) and the touch points a lead gets from it (the copy). */
export type TouchPointType = 'call' | 'email';

export interface TouchPointTemplate {
  order: number;
  type: TouchPointType;
  label: string;
  dayOffset: number;
}

export interface Workflow {
  id: string;
  campaignCode: string;
  name: string;
  touchPoints: TouchPointTemplate[];
  /** Set when the Admin created / edited the campaign. A built-in campaign that was never edited has none. */
  updatedAt?: string;
  /** How many leads use this campaign (sent by the server). */
  leadCount?: number;
}

export type TouchPointStatus = 'pending' | 'overdue' | 'completed' | 'skipped';

export interface TouchPoint {
  order: number;
  type: TouchPointType;
  label: string;
  dayOffset: number;
  status: TouchPointStatus;
  completedAt: string | null;
  dueDate: string | null;
  skippedAt?: string | null;
}

export interface DraftStep { type: TouchPointType; label: string; gapDays: number }

export interface WorkflowDraft {
  /** Campaign code, e.g. ACT-001. Cannot change once the campaign exists (leads point at it). */
  campaignCode: string;
  name: string;
  steps: DraftStep[];
}
