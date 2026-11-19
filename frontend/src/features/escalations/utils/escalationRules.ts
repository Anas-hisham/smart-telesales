/** Where a person sits in the company (used to show who is who next to a name). */
import type { Team } from '@/features/teams/types/teams.types';
import { managerOf, teamLeaderOf, teamOfPerson } from '@/features/teams/utils/orgRules';
import type { User } from '@/features/users/types/users.types';

/** Where a person sits: team, Team Leader, Operation Manager, Quality, line of business. Shown next to a name so nobody has to guess who is who. */
export function reportingLine(users: User[], teams: Team[], user: User) {
  const team = teamOfPerson(teams, user);
  return {
    team,
    teamLeader: user.role === 'agent' ? teamLeaderOf(users, teams, user) : undefined,
    manager: user.role === 'admin' ? undefined : managerOf(users, teams, user),
    quality: user.role === 'agent' ? users.find(candidateUser => candidateUser.id === user.qualityId) : undefined,
  };
}
