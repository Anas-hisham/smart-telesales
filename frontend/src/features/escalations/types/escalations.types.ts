import type { User } from '@/features/users/types/users.types';

/** An escalation: someone raises a problem about another person and sends it up the chain. */
export type EscalationStatus = 'open' | 'resolved';

export interface EscalationStep {
  id: string;
  at: string;
  byId: string;
  byName: string;
  action: 'created' | 'forwarded' | 'resolved';
  toId?: string;       // created / forwarded: who it went to
  toName?: string;
  note?: string;
}

export interface Escalation {
  id: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  aboutId: string;     // the person the escalation is about
  aboutName: string;
  title: string;
  details: string;
  handlerId: string;   // who has to act on it now
  status: EscalationStatus;
  steps: EscalationStep[];
  /** What the signed-in person may do with it right now (sent by the server in the list). */
  myActions?: { canForward: boolean; canResolve: boolean; forwardTargets: User[] };
}
