import { TodayMeetingsCard } from '@/features/dashboard/components/TodayMeetingsCard';
import type { DashboardDto } from '@/features/dashboard/types/dashboard.types';
import type { User } from '@/features/users/types/users.types';
import { Collapsible } from '@/shared/components/Collapsible';

export function OperationManagerDashboard({ data, users }: { data: Extract<DashboardDto, { role: 'operation_manager' }>; users: User[] }) {
  const todayMeetings = data.meetingsToday;
  // an Operation Manager sees the teams he manages (the server already sends only those)
  const tlStats = data.teams.map(teamEntry => ({
    tl: teamEntry.leader, team: teamEntry.team, agents: teamEntry.agents,
    agentRows: teamEntry.agents.map(agentEntry => ({ agent: agentEntry.agent, calls: agentEntry.calls, target: agentEntry.target })),
    todayCalls: teamEntry.todayCalls, teamTarget: teamEntry.teamTarget, teamEmails: teamEntry.emailsToday, teamMeetings: teamEntry.meetingsToday,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Operations Overview</h2>
        <p className="text-sm text-slate-600">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <TodayMeetingsCard meetings={todayMeetings} users={users} title="Meetings Today" />

      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Team Leader Performance — Today</h3>
        <div className="space-y-3">
          {tlStats.map(({ tl: teamLeader, team, agents, agentRows, todayCalls, teamTarget, teamEmails, teamMeetings }) => {
            if (!teamLeader) return null;
            const teamPercent = teamTarget > 0 ? Math.min((todayCalls.total / teamTarget) * 100, 100) : 0;
            return (
              <div key={team.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0" style={{ backgroundColor: teamLeader.color }}>
                    {teamLeader.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900">{teamLeader.name}</div>
                    <div className="text-xs text-slate-600">@{teamLeader.username} • {team?.name} • {agents.length} agents</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${teamPercent >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                      style={{ width: `${Math.max(teamPercent, 2)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 shrink-0">{todayCalls.total}/{teamTarget} ({Math.round(teamPercent)}%)</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                  <div className="bg-blue-50 rounded-lg py-1.5">
                    <div className="text-sm font-bold text-blue-700">{todayCalls.total}</div>
                    <div className="text-[11px] text-slate-600">Calls</div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg py-1.5">
                    <div className="text-sm font-bold text-emerald-700">{todayCalls.discovery}</div>
                    <div className="text-[11px] text-slate-600">Disc.</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg py-1.5">
                    <div className="text-sm font-bold text-amber-700">{todayCalls.lvm}</div>
                    <div className="text-[11px] text-slate-600">LVM</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg py-1.5">
                    <div className="text-sm font-bold text-amber-700">{todayCalls.nvm}</div>
                    <div className="text-[11px] text-slate-600">NVM</div>
                  </div>
                  <div className="bg-violet-50 rounded-lg py-1.5">
                    <div className="text-sm font-bold text-violet-700">{teamEmails}</div>
                    <div className="text-[11px] text-slate-600">Emails</div>
                  </div>
                  <div className="bg-violet-50 rounded-lg py-1.5">
                    <div className="text-sm font-bold text-violet-700">{teamMeetings}</div>
                    <div className="text-[11px] text-slate-600">Meet.</div>
                  </div>
                </div>

                {/* the arrow opens the agents of this team: who made how many calls today */}
                <Collapsible
                  defaultOpen={false}
                  className="mt-3 border-t border-slate-100 pt-3"
                  header={<span className="text-xs font-medium text-slate-600">Agents ({agentRows.length})</span>}
                >
                  <ul className="mt-2 space-y-1.5 pl-6">
                    {agentRows.map(({ agent, calls, target }) => {
                      const agentPercent = target > 0 ? Math.min((calls.total / target) * 100, 100) : 0;
                      return (
                        <li key={agent.id} className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0" style={{ backgroundColor: agent.color }}>{agent.initials}</div>
                          <span className="text-xs text-slate-800 w-24 sm:w-32 truncate">{agent.name}</span>
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${agentPercent >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${Math.max(agentPercent, 2)}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-slate-700 w-14 text-right">{calls.total}/{target}</span>
                        </li>
                      );
                    })}
                  </ul>
                </Collapsible>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
