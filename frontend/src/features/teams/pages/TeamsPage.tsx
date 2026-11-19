import { ArrowRightLeft, BadgeCheck, Crown, Repeat, Shield, UserCog } from 'lucide-react';
import { useState } from 'react';
import { AssignManagerModal } from '@/features/teams/components/AssignManagerModal';
import { AssignQualityModal } from '@/features/teams/components/AssignQualityModal';
import { MoveAgentModal } from '@/features/teams/components/MoveAgentModal';
import { assignTeamToManager, moveAgentToTeam, setAgentQuality } from '@/features/teams/thunks/teams.thunks';
import type { Team } from '@/features/teams/types/teams.types';
import { lobOfTeam, qualityChoicesFor } from '@/features/teams/utils/orgRules';
import type { User } from '@/features/users/types/users.types';
import { Collapsible } from '@/shared/components/Collapsible';
import { UserAvatar } from '@/shared/components/UserAvatar';
import { useStore } from '@/store/hooks';

/** Everybody sees who is in which team: Operation Manager on top, then each Team Leader with their agents. */
export function TeamsPage() {
  const { state, dispatch } = useStore();
  const currentUser = state.users.find(user => user.id === state.currentUserId)!;
  const [moving, setMoving] = useState<User | null>(null);
  const [reassigning, setReassigning] = useState<Team | null>(null);     // Admin: the team whose manager is being changed
  const [changingQuality, setChangingQuality] = useState<User | null>(null);
  const isAdmin = currentUser.role === 'admin';

  const findUserById = (id: string) => state.users.find(user => user.id === id);
  const managers = state.users.filter(user => user.role === 'operation_manager');
  const quality = state.users.filter(user => user.role === 'quality');
  const findTeamOfAgent = (agentId: string) => state.teams.find(team => team.agentIds.includes(agentId));
  const unassigned = state.users.filter(user => user.role === 'agent' && !findTeamOfAgent(user.id));
  const canMove = () => isAdmin;                    // only the Admin moves an agent to another team / Team Leader
  const myTeams = state.teams;
  const teamsWithoutManager = state.teams.filter(team => !state.users.some(user => user.id === team.managerId));
  const lobChip = (lob?: string) => <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">{lob || 'No LOB'}</span>;

  const person = (user: User, extra?: React.ReactNode) => (
    <div className="flex items-center gap-3 min-w-0">
      <UserAvatar user={user} />
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-900 truncate">{user.name}{user.id === currentUser.id && <span className="ml-1.5 text-xs font-normal text-blue-600">(you)</span>}</div>
        <div className="text-xs text-slate-600 truncate">@{user.username}</div>
      </div>
      {extra}
    </div>
  );

  /** One person row, the same for the Team Leader and every agent: avatar + name on the left, the Admin's buttons always on the right, never on a second line. */
  const renderPersonRow = (user: User, meta: React.ReactNode, actions: React.ReactNode) => (
    <div className="flex items-center gap-3 px-4 py-3">
      <UserAvatar user={user} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900 truncate">{user.name}{user.id === currentUser.id && <span className="ml-1.5 text-xs font-normal text-blue-600">(you)</span>}</div>
        <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
          <span className="text-xs text-slate-600 truncate">@{user.username}</span>
          {meta}
        </div>
      </div>
      {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
    </div>
  );
  const actionBtn = 'h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors';

  const agentRow = (agent: User) => {
    const user = findUserById(agent.qualityId ?? '');
    return (
      <li key={agent.id}>
        {renderPersonRow(
          agent,
          <span className="text-[11px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-1" title={user ? 'Quality who follows this agent' : 'No Quality yet'}>
            <BadgeCheck className="w-3 h-3" />{user ? user.name.split(' ')[0] : 'No Quality'}
          </span>,
          <>
            {isAdmin && (
              <button onClick={() => setChangingQuality(agent)} title="Change Quality" aria-label={`Change Quality of ${agent.name}`}
                className={`${actionBtn} text-amber-700 bg-amber-50 hover:bg-amber-100`}>
                <UserCog className="w-3.5 h-3.5" />Quality
              </button>
            )}
            {canMove() && (
              <button onClick={() => setMoving(agent)} title="Move to another team (changes the Team Leader)" aria-label={`Move ${agent.name} to another team`}
                className={`${actionBtn} text-blue-700 bg-blue-50 hover:bg-blue-100`}>
                <ArrowRightLeft className="w-3.5 h-3.5" />Team / TL
              </button>
            )}
          </>,
        )}
      </li>
    );
  };

  const teamCard = (team: Team) => {
    const leader = findUserById(team.leaderId);
    const agents = team.agentIds.map(findUserById).filter((user): user is User => !!user);
    return (
      <Collapsible
        key={team.id}
        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
        headerClassName="px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
        header={
          <span className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-slate-900">{team.name}</span>
            <span className="text-xs text-slate-600">{agents.length} agent{agents.length === 1 ? '' : 's'}</span>
          </span>
        }
      >
        {leader && (
          <div className="border-t border-b border-slate-100">
            {renderPersonRow(
              leader,
              <span className="text-[11px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0"><Shield className="w-3 h-3" />Team Leader</span>,
              isAdmin && (
                <button onClick={() => setReassigning(team)} title="Change the Operation Manager of this team" aria-label={`Change manager of ${team.name}`}
                  className={`${actionBtn} text-blue-700 bg-blue-50 hover:bg-blue-100`}>
                  <Repeat className="w-3.5 h-3.5" />Manager
                </button>
              ),
            )}
          </div>
        )}
        <ul className="divide-y divide-slate-100">
          {agents.map(agentRow)}
          {agents.length === 0 && <li className="px-4 py-4 text-sm text-slate-500">No agents in this team</li>}
        </ul>
      </Collapsible>
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Teams</h2>
        <p className="text-sm text-slate-600">
          {state.teams.length} teams · {state.users.filter(user => user.role === 'agent').length} agents · click an arrow to open or close a group
          {isAdmin && ' · Team / TL puts an agent in another team (another Team Leader) · Manager changes a team’s Operation Manager · Quality changes the Quality of an agent (same LOB only)'}
        </p>
      </div>

      {managers.map(manager => {
        const teams = state.teams.filter(team => team.managerId === manager.id);
        const agentCount = teams.reduce((count, team) => count + team.agentIds.length, 0);
        return (
          <Collapsible
            key={manager.id}
            className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 sm:p-5"
            headerClassName="rounded-xl bg-white border border-blue-200 shadow-sm px-4 py-3 hover:bg-blue-50/50 transition-colors"
            /* the manager is the header of the panel: every team below belongs to him, however many there are */
            header={
              <span className="flex items-center justify-between gap-3 flex-wrap">
                {person(manager)}
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-600">{teams.length} team{teams.length === 1 ? '' : 's'} · {agentCount} agents</span>
                  {lobChip(manager.lob)}
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1"><Crown className="w-3 h-3" />Manager</span>
                </span>
              </span>
            }
          >
            {/* plain grid: the first row fills left → middle → right, the next team starts again on the LEFT of a new row */}
            {teams.length > 0 && (
              <div className="grid gap-4 m:grid-cols-2 xl:grid-cols-2 items-start mt-4">{teams.map(teamCard)}</div>
            )}
          </Collapsible>
        );
      })}

      {teamsWithoutManager.length > 0 && (
        <Collapsible
          className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 sm:p-5"
          headerClassName="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 hover:bg-slate-100 transition-colors"
          header={<span className="text-sm font-bold text-slate-900">Teams without an Operation Manager <span className="ml-1 text-xs font-normal text-slate-600">({teamsWithoutManager.length})</span></span>}
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 items-start mt-4">{teamsWithoutManager.map(teamCard)}</div>
        </Collapsible>
      )}

      {quality.length > 0 && (
        <Collapsible
          className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 sm:p-5"
          headerClassName="rounded-xl bg-white border border-amber-200 shadow-sm px-4 py-3 hover:bg-amber-50/50 transition-colors"
          header={
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-900">Quality</span>
              <span className="text-xs text-slate-600">{quality.length} member{quality.length === 1 ? '' : 's'}</span>
            </span>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 mt-4">
            {quality.map(user => (
              <div key={user.id} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center justify-between gap-2">
                {person(user)}
                <span className="shrink-0 flex items-center gap-1.5">
                  <span className="text-xs text-slate-600">{state.users.filter(candidateUser => candidateUser.role === 'agent' && candidateUser.qualityId === user.id).length} agents</span>
                  {lobChip(user.lob)}
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1"><BadgeCheck className="w-3 h-3" />Quality</span>
                </span>
              </div>
            ))}
          </div>
        </Collapsible>
      )}

      {unassigned.length > 0 && (
        <Collapsible
          className="bg-white rounded-xl border border-dashed border-slate-300 overflow-hidden"
          headerClassName="px-4 py-3 bg-slate-50 hover:bg-slate-100"
          header={<span className="text-sm font-bold text-slate-900">Agents without a team <span className="ml-1 text-xs font-normal text-slate-600">({unassigned.length})</span></span>}
        >
          <ul className="divide-y divide-slate-100 border-t border-slate-100">{unassigned.map(agentRow)}</ul>
        </Collapsible>
      )}

      {reassigning && (
        <AssignManagerModal
          team={reassigning} managers={managers} currentLob={lobOfTeam(state.users, reassigning)}
          onClose={() => setReassigning(null)}
          onAssign={managerId => { dispatch(assignTeamToManager({ teamId: reassigning.id, managerId })); setReassigning(null); }}
        />
      )}
      {changingQuality && (
        <AssignQualityModal
          agent={changingQuality} choices={qualityChoicesFor(state.users, state.teams, changingQuality)}
          lob={lobOfTeam(state.users, findTeamOfAgent(changingQuality.id))} users={state.users}
          onClose={() => setChangingQuality(null)}
          onAssign={qualityId => { dispatch(setAgentQuality({ agentId: changingQuality.id, qualityId })); setChangingQuality(null); }}
        />
      )}
      {moving && (
        <MoveAgentModal
          agent={moving} fromTeam={findTeamOfAgent(moving.id)} teams={myTeams} users={state.users}
          onClose={() => setMoving(null)}
          onMove={toTeamId => { dispatch(moveAgentToTeam({ agentId: moving.id, toTeamId })); setMoving(null); }}
        />
      )}
    </div>
  );
}
