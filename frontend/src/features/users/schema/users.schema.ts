/** The rules for a new account the Admin creates. Pure functions: the form shows the message (the server checks the same input again). */
import { MIN_PASSWORD_LENGTH } from '@/features/users/constants/users.constants';
import type { Team } from '@/features/teams/types/teams.types';
import { LOB_CODES } from '@/features/teams/utils/orgRules';
import type { NewUserInput, User } from '@/features/users/types/users.types';
import { qualityChoicesForTeam } from '@/features/users/utils/users.utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isSameText = (textA: string, textB: string) => textA.trim().toLowerCase() === textB.trim().toLowerCase();

/** The first thing wrong with the input, or null when the account can be created. */
export function validateNewUser(users: User[], teams: Team[], input: NewUserInput): string | null {
  if (!input.name.trim()) return 'Enter the full name.';
  if (!EMAIL_RE.test(input.email.trim())) return 'Enter a valid email address.';
  if (users.some(user => isSameText(user.email, input.email))) return 'This email already belongs to another account.';
  if (input.password.length < MIN_PASSWORD_LENGTH) return `The password needs at least ${MIN_PASSWORD_LENGTH} characters.`;

  if (input.role === 'operation_manager' || input.role === 'quality') {
    if (!(LOB_CODES as readonly string[]).includes(input.lob)) return 'Choose the line of business (LOB).';
  } else if (input.role === 'team_leader') {
    if (!input.teamName.trim()) return 'Enter the name of the new team.';
    if (teams.some(team => isSameText(team.name, input.teamName))) return 'A team with this name already exists.';
    if (input.managerId && !users.some(user => user.id === input.managerId && user.role === 'operation_manager')) return 'Choose a valid Operation Manager.';
  } else {
    const team = teams.find(candidateTeam => candidateTeam.id === input.teamId);
    if (!team) return 'Choose the team of the agent.';
    if (input.qualityId && !qualityChoicesForTeam(users, teams, team.id).some(user => user.id === input.qualityId)) {
      return 'The Quality must be of the same line of business as the team.';
    }
    if (!Number.isInteger(input.dailyCallTarget) || input.dailyCallTarget < 1 || input.dailyCallTarget > 500) return 'The daily call target must be between 1 and 500.';
  }
  return null;
}
