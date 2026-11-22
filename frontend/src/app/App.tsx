import { useEffect, useState } from 'react';
import { AppShell } from '@/app/layout/AppShell';
import { canOpenPage, homePageFor, type PageId } from '@/app/navigation';
import { KnowledgePage } from '@/features/ai/pages/KnowledgePage';
import { AnalyticsPage } from '@/features/analytics/pages/AnalyticsPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { bootSession, logout } from '@/features/auth/thunks/auth.thunks';
import { CampaignsPage } from '@/features/campaigns/pages/CampaignsPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { EscalationsPage } from '@/features/escalations/pages/EscalationsPage';
import { LeadPoolPage } from '@/features/lead-pool/pages/LeadPoolPage';
import { CalendarPage } from '@/features/meetings/pages/CalendarPage';
import { MyLeadsPage } from '@/features/my-leads/pages/MyLeadsPage';
import { SalesPage } from '@/features/sales/pages/SalesPage';
import { TasksPage } from '@/features/tasks/pages/TasksPage';
import { TeamUpdatesPage } from '@/features/team-updates/pages/TeamUpdatesPage';
import { TeamsPage } from '@/features/teams/pages/TeamsPage';
import { TipsPage } from '@/features/tips/pages/TipsPage';
import { UsersPage } from '@/features/users/pages/UsersPage';
import { WorkQueuePage } from '@/features/work-queue/pages/WorkQueuePage';
import { useSyncTick } from '@/features/workspace/hooks/useSyncTick';
import { useStore } from '@/store/hooks';

export function App() {
  const { state, dispatch } = useStore();
  const [page, setPage] = useState<PageId>('dashboard');

  // a saved login is checked once when the page opens
  useEffect(() => { if (state.session === 'booting') void dispatch(bootSession()); }, [state.session, dispatch]);
  useSyncTick(state.session === 'ready');

  if (state.session === 'booting' || (state.session === 'ready' && state.loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm" role="status">
        <div className="w-5 h-5 mr-3 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" /> Loading your workspace…
      </div>
    );
  }
  if (state.session === 'anonymous') return <LoginPage />;

  // If the page left open from the previous person is not allowed for this role, go to their home page
  const role = state.users.find(user => user.id === state.currentUserId)?.role;
  const currentPage: PageId = role && !canOpenPage(page, role) ? homePageFor(role) : page;

  return (
    <AppShell
      currentPage={currentPage}
      onNavigate={setPage}
      onLogout={() => { setPage('dashboard'); void dispatch(logout()); }}
    >
      {currentPage === 'adminleads' && <LeadPoolPage />}
      {currentPage === 'campaigns' && <CampaignsPage />}
      {currentPage === 'users' && <UsersPage />}
      {currentPage === 'dashboard' && <DashboardPage />}
      {currentPage === 'workqueue' && <WorkQueuePage />}
      {currentPage === 'calendar' && <CalendarPage />}
      {currentPage === 'leads' && <MyLeadsPage />}
      {currentPage === 'updates' && <TeamUpdatesPage />}
      {currentPage === 'tasks' && <TasksPage />}
          {currentPage === 'sales' && <SalesPage />}
      {currentPage === 'analytics' && <AnalyticsPage />}
      {currentPage === 'teams' && <TeamsPage />}
      {currentPage === 'escalations' && <EscalationsPage />}
      {currentPage === 'tips' && <TipsPage />}
      {currentPage === 'knowledge' && <KnowledgePage />}
    </AppShell>
  );
}
