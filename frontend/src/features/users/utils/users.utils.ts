import type { Team } from '@/features/teams/types/teams.types';
import { lobOfTeam } from '@/features/teams/utils/orgRules';
import type { User } from '@/features/users/types/users.types';

/** The Quality members an agent of this team may be given (the LOB of the team's manager). Empty when the team has no manager. */
export function qualityChoicesForTeam(users: User[], teams: Team[], teamId: string): User[] {
  const team = teams.find(candidateTeam => candidateTeam.id === teamId);
  const lob = lobOfTeam(users, team);
  return lob ? users.filter(user => user.role === 'quality' && user.lob === lob) : [];
}

/** username = the part of the email before the @, made unique with a number when somebody already has it. */
export function usernameFromEmail(users: User[], email: string): string {
  const base = email.trim().toLowerCase().split('@')[0].replace(/[^a-z0-9._-]/g, '') || 'user';
  let name = base;
  for (let index = 2; users.some(user => user.username === name); index++) name = `${base}${index}`;
  return name;
}
