import type { ApiLead } from '@/features/leads/types/leads.types';
import type { Meeting } from '@/features/meetings/types/meetings.types';
import type { Team } from '@/features/teams/types/teams.types';
import type { User } from '@/features/users/types/users.types';

export type DashboardDto =
  | { role: 'agent'; dailyCallTarget: number; todayCalls: { nvm: number; lvm: number; discovery: number; total: number }; emailsToday: number; salesThisMonth: number; meetingsToday: Meeting[] }
  | { role: 'team_leader'; team: Team | null; meetingsToday: Meeting[]; expiredLeads: ApiLead[];
      agents: { agent: User; todayCalls: { nvm: number; lvm: number; discovery: number; total: number }; dailyCallTarget: number; emailsToday: number; meetingsToday: number }[] }
  | { role: 'operation_manager'; meetingsToday: Meeting[];
      teams: { team: Team; leader: User | null; todayCalls: { nvm: number; lvm: number; discovery: number; total: number }; teamTarget: number; emailsToday: number; meetingsToday: number; agents: { agent: User; calls: { nvm: number; lvm: number; discovery: number; total: number }; target: number }[] }[] };
