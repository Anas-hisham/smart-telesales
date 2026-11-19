/** Who an update is addressed to. The author is never a recipient of his own update. */
import type { TeamUpdate } from '@/features/team-updates/types/teamUpdates.types';
import type { Team } from '@/features/teams/types/teams.types';
import { lobOf } from '@/features/teams/utils/orgRules';
import type { User } from '@/features/users/types/users.types';

export function updateRecipients(update: Pick<TeamUpdate, 'audience' | 'teamId' | 'authorId' | 'recipients'>, users: User[], teams: Team[]): User[] {
  // the server already worked out who the update reached
  if (update.recipients) return update.recipients.map(recipient => users.find(user => user.id === recipient.id)).filter((user): user is User => !!user);

  // an Operation Manager runs one line of business: his updates reach the people of that LOB only
  const author = users.find(user => user.id === update.authorId);
  const lob = author?.role === 'operation_manager' ? author.lob ?? '' : '';
  const inScope = (user: User) => !lob || lobOf(users, teams, user) === lob;
  const pool = (() => {
    switch (update.audience) {
      case 'all': return users.filter(user => (user.role === 'team_leader' || user.role === 'agent' || user.role === 'quality') && inScope(user));
      case 'team_leaders': return users.filter(user => user.role === 'team_leader' && inScope(user));
      case 'quality': return users.filter(user => user.role === 'quality' && inScope(user));
      case 'specific_team': {
        const team = teams.find(candidateTeam => candidateTeam.id === update.teamId);
        return users.filter(user => !!team && team.agentIds.includes(user.id));
      }
    }
  })();
  return pool.filter(user => user.id !== update.authorId);
}
