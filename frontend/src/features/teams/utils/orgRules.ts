/** Who belongs where: teams, managers, Quality and the line of business (LOB) of everybody. Pure functions. */
import type { Team } from '@/features/teams/types/teams.types';
import type { User } from '@/features/users/types/users.types';

/** The lines of business. Every Operation Manager runs one of them. */
export const LOB_CODES = ['REG', 'DJ'] as const;

/** The team a Team Leader leads, or an agent sits in. */
export function teamOfPerson(teams: Team[], user: User): Team | undefined {
  if (user.role === 'team_leader') return teams.find(team => team.leaderId === user.id);
  if (user.role === 'agent') return teams.find(team => team.agentIds.includes(user.id));
  return undefined;
}

/** The LOB of a team = the LOB of its Operation Manager ('' when it has no manager). */
export const lobOfTeam = (users: User[], team: Team | undefined): string =>
  users.find(user => user.id === team?.managerId)?.lob ?? '';

/** The LOB of a person ('' when unknown: the Admin, or a team that has no manager at the moment). */
export function lobOf(users: User[], teams: Team[], user: User): string {
  if (user.role === 'operation_manager' || user.role === 'quality') return user.lob ?? '';
  return lobOfTeam(users, teamOfPerson(teams, user));
}

export const teamLeaderOf = (users: User[], teams: Team[], user: User): User | undefined =>
  users.find(candidateUser => candidateUser.id === teamOfPerson(teams, user)?.leaderId);

/** The Operation Manager above a person. Quality has no team: its manager is the OM of its LOB. */
export function managerOf(users: User[], teams: Team[], user: User): User | undefined {
  if (user.role === 'quality') return user.lob ? users.find(candidateUser => candidateUser.role === 'operation_manager' && candidateUser.lob === user.lob) : undefined;
  return users.find(candidateUser => candidateUser.id === teamOfPerson(teams, user)?.managerId);
}

/** The Quality members an agent may be given: the same LOB only. */
export function qualityChoicesFor(users: User[], teams: Team[], agent: User): User[] {
  const lob = lobOf(users, teams, agent);
  return lob ? users.filter(user => user.role === 'quality' && user.lob === lob) : [];
}
