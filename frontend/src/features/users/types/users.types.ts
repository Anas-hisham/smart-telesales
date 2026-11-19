/** Who can sign in and what role they have. */
export type UserRole = 'admin' | 'operation_manager' | 'team_leader' | 'agent' | 'quality';

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  teamId?: string;
  initials: string;
  color: string;
  dailyCallTarget: number;
  /** Line of business (e.g. REG, DJ). Set on Operation Managers and Quality. Teams, Team Leaders and agents take the LOB of their manager. */
  lob?: string;
  /** Agents only: the Quality member who follows this agent (always one of the same LOB). */
  qualityId?: string;
}

/** The roles the Admin can create here (the Admin account is not created from this page). */
export type CreatableRole = 'operation_manager' | 'team_leader' | 'agent' | 'quality';

interface Common { name: string; email: string; password: string }
export type NewUserInput =
  | (Common & { role: 'operation_manager'; lob: string })
  | (Common & { role: 'quality'; lob: string })
  /** A Team Leader always comes with a NEW team of his own. managerId '' = the team has no Operation Manager for now. */
  | (Common & { role: 'team_leader'; teamName: string; managerId: string })
  /** An agent joins an existing team. qualityId '' = no Quality for now. */
  | (Common & { role: 'agent'; teamId: string; qualityId: string; dailyCallTarget: number });
