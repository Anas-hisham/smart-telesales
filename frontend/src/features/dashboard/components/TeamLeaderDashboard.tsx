import { ReassignRow } from '@/features/dashboard/components/ReassignRow';
import { TodayMeetingsCard } from '@/features/dashboard/components/TodayMeetingsCard';
import type { DashboardDto } from '@/features/dashboard/types/dashboard.types';
import { transferLeadToAgent } from '@/features/leads/thunks/leads.thunks';
import type { User } from '@/features/users/types/users.types';
import { useConfirm } from '@/shared/components/ConfirmDialog';
import { useAppDispatch } from '@/store/hooks';

export function TeamLeaderDashboard({ data, users, onChanged }: {
  data: Extract<DashboardDto, { role: 'team_leader' }>; users: User[]; onChanged: () => void;
}) {
  const dispatch = useAppDispatch();
  const { ask, dialog: confirmDialog } = useConfirm();
  const myTeam = data.team;
  const teamAgents = data.agents.map(agentEntry => agentEntry.agent);
  const expiredLeads = data.expiredLeads;
  const todayMeetings = data.meetingsToday;
  const agentStats = data.agents.map(agent => ({ agent: agent.agent, todayCalls: agent.todayCalls, emails: agent.emailsToday, meetings: agent.meetingsToday }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">{myTeam?.name ?? 'Team'} Dashboard</h2>
        <p className="text-sm text-slate-600">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {confirmDialog}

      <TodayMeetingsCard meetings={todayMeetings} users={users} title="Team Meetings Today" />

      {expiredLeads.length > 0 && (
        <div className="bg-rose-50/50 rounded-xl border border-rose-100 p-5">
          <h3 className="text-sm font-semibold text-rose-900 mb-1">Needs reassignment ({expiredLeads.length})</h3>
          <p className="text-xs text-slate-600 mb-3">No progress for 15 days. The new agent starts from touch point 1; the old history is kept.</p>
          <div className="space-y-2">
            {expiredLeads.map(expiredLead => (
              <ReassignRow
                key={expiredLead.id} lead={expiredLead} agents={teamAgents}
                ownerName={expiredLead.agentName ?? users.find(user => user.id === expiredLead.agentId)?.name ?? '—'}
                onReassign={agentId => ask(
                  { title: 'Reassign this lead?', message: <><b>{expiredLead.companyName}</b> will move to <b>{users.find(user => user.id === agentId)?.name ?? 'the selected agent'}</b> and start again from touch point 1. The old history is kept.</>, confirmLabel: 'Reassign' },
                  async () => { if (await dispatch(transferLeadToAgent({ leadId: expiredLead.id, newAgentId: agentId }))) onChanged(); },
                )}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Agent Performance — Today</h3>
        <div className="space-y-3">
          {agentStats.map(({ agent, todayCalls, emails, meetings }) => {
            const target = agent.dailyCallTarget;
            const percent = target > 0 ? Math.min((todayCalls.total / target) * 100, 100) : 0;
            return (
              <div key={agent.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0" style={{ backgroundColor: agent.color }}>
                    {agent.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900">{agent.name}</div>
                    <div className="text-xs text-slate-600">@{agent.username}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${percent >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                      style={{ width: `${Math.max(percent, 2)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 shrink-0">{todayCalls.total}/{target}</span>
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
                    <div className="text-sm font-bold text-violet-700">{emails}</div>
                    <div className="text-[11px] text-slate-600">Emails</div>
                  </div>
                  <div className="bg-violet-50 rounded-lg py-1.5">
                    <div className="text-sm font-bold text-violet-700">{meetings}</div>
                    <div className="text-[11px] text-slate-600">Meet.</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
