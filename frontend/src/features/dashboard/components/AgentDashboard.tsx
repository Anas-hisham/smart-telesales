import { Calendar, Mail, Target, Trophy } from 'lucide-react';
import { CallBreakdown } from '@/features/dashboard/components/CallBreakdown';
import { StatCard } from '@/features/dashboard/components/StatCard';
import { TodayMeetingsCard } from '@/features/dashboard/components/TodayMeetingsCard';
import type { DashboardDto } from '@/features/dashboard/types/dashboard.types';
import type { User } from '@/features/users/types/users.types';

export function AgentDashboard({ currentUser, data, users }: {
  currentUser: User; data: Extract<DashboardDto, { role: 'agent' }>; users: User[];
}) {
  const calls = data.todayCalls;
  const target = data.dailyCallTarget || currentUser.dailyCallTarget;
  const progressPct = target > 0 ? Math.min((calls.total / target) * 100, 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">My Dashboard</h2>
        <p className="text-sm text-slate-600">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <TodayMeetingsCard meetings={data.meetingsToday} users={users} />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-slate-900">Today's Call Progress</span>
          </div>
          <span className="text-sm font-bold text-slate-900">{calls.total} / {target}</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progressPct >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
            style={{ width: `${Math.max(progressPct, 2)}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">{Math.round(progressPct)}% of daily target</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Today's Call Breakdown</h3>
        <CallBreakdown stats={calls} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Emails Sent Today" value={data.emailsToday} icon={Mail} color="text-violet-600 bg-violet-50" />
        <StatCard label="Meetings Today" value={data.meetingsToday.length} icon={Calendar} color="text-violet-600 bg-violet-50" />
        <StatCard label="Sales This Month" value={data.salesThisMonth} icon={Trophy} color="text-amber-600 bg-amber-50" />
      </div>

    </div>
  );
}
