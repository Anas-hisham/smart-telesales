import { AgentDashboard } from '@/features/dashboard/components/AgentDashboard';
import { OperationManagerDashboard } from '@/features/dashboard/components/OperationManagerDashboard';
import { TeamLeaderDashboard } from '@/features/dashboard/components/TeamLeaderDashboard';
import { useDashboard } from '@/features/dashboard/hooks/useDashboard';
import { useStore } from '@/store/hooks';

export function DashboardPage() {
  const { state } = useStore();
  const currentUser = state.users.find(user => user.id === state.currentUserId)!;
  const { data, error, reload } = useDashboard();

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {!data && !error &&   <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 text-slate-500 text-sm" role="status">
        <div className="w-5 h-5 mr-3 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" /> Loading your dashboard…
      </div>}
      {error && !data && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-4" role="alert">
          {error} <button onClick={reload} className="underline ml-2">Try again</button>
        </div>
      )}
      {data?.role === 'agent' && <AgentDashboard currentUser={currentUser} data={data} users={state.users} />}
      {data?.role === 'team_leader' && <TeamLeaderDashboard data={data} users={state.users} onChanged={reload} />}
      {data?.role === 'operation_manager' && <OperationManagerDashboard data={data} users={state.users} />}
    </div>
  );
}
