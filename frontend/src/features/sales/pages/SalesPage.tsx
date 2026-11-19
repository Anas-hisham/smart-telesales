import { ChevronDown, ChevronLeft, ChevronRight, Crown, Plus, Target, Trash2, Trophy } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { salesApi } from '@/features/sales/api/sales.api';
import { AgentSalesDetails } from '@/features/sales/components/AgentSalesDetails';
import { RecordSaleModal } from '@/features/sales/components/RecordSaleModal';
import { SaleTypeChips } from '@/features/sales/components/SaleTypeChips';
import { SortDirectionButton } from '@/features/sales/components/SortDirectionButton';
import { TargetProgressBar } from '@/features/sales/components/TargetProgressBar';
import { TopAgentsCard } from '@/features/sales/components/TopAgentsCard';
import { AGENT_SALES_TARGET, SALE_TYPES, saleTypeConfig } from '@/features/sales/constants/sales.constants';
import { deleteSale, recordSale } from '@/features/sales/thunks/sales.thunks';
import type { AgentRank, SalesOverview, SaleType, SortDirection } from '@/features/sales/types/sales.types';
import { reportError } from '@/shared/api/apiErrors';
import { errorText } from '@/shared/api/client';
import { Collapsible } from '@/shared/components/Collapsible';
import { useConfirm } from '@/shared/components/ConfirmDialog';
import { Pagination } from '@/shared/components/Pagination';
import { UserAvatar } from '@/shared/components/UserAvatar';
import { usePagination } from '@/shared/hooks/usePagination';
import { currentMonthKey, monthLabel, shiftMonth } from '@/shared/lib/dates';
import { useStore } from '@/store/hooks';

type Group = SalesOverview['groups'][number];
const sumTypes = (list: Partial<Record<SaleType, number>>[]) =>
  Object.fromEntries(SALE_TYPES.map(saleTypeOption => [saleTypeOption.value, list.reduce((count, countsByType) => count + (countsByType[saleTypeOption.value] ?? 0), 0)])) as Record<SaleType, number>;

// ---------------------------------------------------------------------------
// page
// ---------------------------------------------------------------------------
export function SalesPage() {
  const { state, dispatch } = useStore();
  const { ask, dialog: confirmDialog } = useConfirm();
  const currentUser = state.users.find(user => user.id === state.currentUserId)!;
  const isQuality = currentUser.role === 'quality';
  const isAgent = currentUser.role === 'agent';
  const isTeamLeader = currentUser.role === 'team_leader';
  const isOperationManager = currentUser.role === 'operation_manager';

  const [month, setMonth] = useState(currentMonthKey());
  const [rowDir, setRowDir] = useState<SortDirection>('desc');     // order of agents / teams by number of sales
  const [listDir, setListDir] = useState<SortDirection>('desc');   // order of the sales list by date
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());   // agents whose "More details" is open
  const toggleExpanded = (id: string) => setExpanded(prev => { const updatedSet = new Set(prev); if (updatedSet.has(id)) updatedSet.delete(id); else updatedSet.add(id); return updatedSet; });

  // The server counts the month (GET /sales/overview): every team's totals, the top agents, and the sales list of MY scope.
  const [overview, setOverview] = useState<SalesOverview | null>(null);
  const [loadError, setLoadError] = useState('');
  const load = useCallback(async () => {
    try { setOverview(await salesApi.overview(month)); setLoadError(''); }
    catch (error) { setLoadError(errorText(error)); }
  }, [month]);
  useEffect(() => { setOverview(null); void load(); }, [load]);

  const groups: Group[] = overview?.groups ?? [];
  const scope = overview?.scope;
  const monthSales = overview?.sales ?? [];   // only the sales of the agents this person follows / manages

  // each agent's target = the team's target / its agents (the server owns the number: SALES_TARGET_PER_AGENT)
  const perAgentTarget = useMemo(() => {
    const group = groups.find(candidateGroup => candidateGroup.agents.length > 0);
    return group ? Math.round(group.target / group.agents.length) : AGENT_SALES_TARGET;
  }, [groups]);

  // my own team(s) open, the others closed until clicked
  const isMyGroup = (group: Group) => group.team.leaderId === currentUser.id || group.team.managerId === currentUser.id || group.agents.some(agentSales => scope?.agentIds.includes(agentSales.agent.id));
  const scopeGroups = groups.filter(isMyGroup);

  const topAgents: AgentRank[] = useMemo(() => (overview?.topAgents ?? []).filter(agentRow => agentRow.sales > 0).slice(0, 5), [overview]);

  // Lead details are private: an agent opens only their own, a team leader only their team's, the OM and Quality everyone's.
  const canSeeDetails = (agentId: string) => {
    if (isAgent) return agentId === currentUser.id;
    if (isTeamLeader) return groups.some(group => group.team.leaderId === currentUser.id && group.agents.some(agent => agent.agent.id === agentId));
    if (isQuality) return state.users.find(user => user.id === agentId)?.qualityId === currentUser.id;   // only the agents it follows
    return true;
  };

  const totalTarget = scope?.target ?? 0;
  const totalCount = scope?.total ?? 0;

  const dirMul = rowDir === 'desc' ? -1 : 1;
  const sortedGroups = useMemo(() =>
    [...groups]
      .map(group => ({ ...group, agents: [...group.agents].sort((agentA, agentB) => dirMul * (agentA.count - agentB.count) || agentA.agent.name.localeCompare(agentB.agent.name)) }))
      .sort((groupA, groupB) => dirMul * (groupA.total - groupB.total) || groupA.team.name.localeCompare(groupB.team.name)),
  [groups, dirMul]);

  const sortedSales = useMemo(
    () => [...monthSales].sort((monthSaleA, monthSaleB) => (listDir === 'desc' ? -1 : 1) * (monthSaleA.date.localeCompare(monthSaleB.date) || monthSaleA.createdAt.localeCompare(monthSaleB.createdAt))),
    [monthSales, listDir],
  );

  const salesPage = usePagination(sortedSales, 15);

  const title = isAgent ? 'My Sales' : isTeamLeader ? `${scopeGroups[0]?.team.name ?? 'Team'} Sales` : isOperationManager ? 'Team Sales' : 'Sales';
  const summaryLabel = isAgent ? 'My monthly target' : isTeamLeader ? 'Team monthly target' : isOperationManager ? 'All teams monthly target' : 'Company monthly target';

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600">
            {isQuality ? 'Record every sale and follow each agent\u2019s progress' : 'Sales recorded by Quality \u00b7 everyone can see everyone\u2019s sales'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg">
            <button onClick={() => setMonth(shiftMonth(month, -1))} className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 rounded-l-lg" aria-label="Previous month">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="px-3 text-sm font-medium text-slate-700 min-w-[130px] text-center">{monthLabel(month)}</span>
            <button onClick={() => setMonth(shiftMonth(month, 1))} className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 rounded-r-lg" aria-label="Next month">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          {isQuality && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Record Sale
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-slate-900">{summaryLabel}</span>
          </div>
          <span className="text-sm font-bold text-slate-900">{totalCount} / {totalTarget}</span>
        </div>
        <TargetProgressBar count={totalCount} target={totalTarget} />
        <div className="mt-3"><SaleTypeChips counts={scope?.byType ?? {}} /></div>
        {!isAgent && (
          <p className="text-xs text-slate-500 mt-3">
            Each agent: {perAgentTarget} sales a month. A team's target is its number of agents × {perAgentTarget}.
          </p>
        )}
      </div>

      {/* Top 5 */}
      <TopAgentsCard ranks={topAgents} teams={state.teams} meId={currentUser.id} monthName={monthLabel(month)} />

      {/* All teams: team leader is clearly marked, agents below can open "More details" */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">All teams</h3>
          <SortDirectionButton dir={rowDir} onToggle={() => setRowDir(previousRowDir => (previousRowDir === 'desc' ? 'asc' : 'desc'))} label="Sales" />
        </div>

        {sortedGroups.length === 0 && <p className="text-sm text-slate-500">No teams to show.</p>}

        <div className="space-y-4">
          {sortedGroups.map(sortedGroup => {
            return (
              <Collapsible
                key={sortedGroup.team.id}
                defaultOpen={isMyGroup(sortedGroup)}   /* my own team(s) open, the others closed until clicked */
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                headerClassName="p-4 bg-violet-50 hover:bg-violet-100/60 transition-colors border-l-4 border-l-violet-500"
                header={
                  <div>
                  <div className="flex items-center gap-3 mb-3">
                    {sortedGroup.leader && (
                      <div className="rounded-full ring-2 ring-violet-400 ring-offset-2 ring-offset-violet-50"><UserAvatar user={sortedGroup.leader} /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{sortedGroup.leader?.name ?? sortedGroup.team.name}</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 bg-violet-100 border border-violet-200 px-2 py-0.5 rounded-full">
                          <Crown className="w-3 h-3" /> Team Leader
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">{sortedGroup.team.name} • {sortedGroup.agents.length} agents</div>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-bold text-slate-900">
                      <Trophy className="w-4 h-4 text-amber-500" /> {sortedGroup.total}
                    </div>
                  </div>
                  <TargetProgressBar count={sortedGroup.total} target={sortedGroup.target} />
                  <div className="mt-2"><SaleTypeChips counts={sumTypes(sortedGroup.agents.map(agent => agent.byType))} /></div>
                                  </div>
                }
              >
                <div className="divide-y divide-slate-100">
                  {sortedGroup.agents.map(({ agent: userA, count, byType }) => {
                    const canOpen = canSeeDetails(userA.id);
                    const open = canOpen && expanded.has(userA.id);
                    const isMe = userA.id === currentUser.id;
                    return (
                      <div key={userA.id} className={`p-4 flex flex-col gap-2 ${isMe ? 'bg-blue-50/40' : ''}`}>
                        <div className="flex items-center gap-3">
                          <UserAvatar user={userA} size="w-8 h-8" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900">
                              {userA.name}
                              <span className="ml-1.5 text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">Agent</span>
                              {isMe && <span className="ml-1 text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full">You</span>}
                            </div>
                            <div className="text-xs text-slate-600">@{userA.username}</div>
                          </div>
                          {canOpen && <button
                            onClick={() => toggleExpanded(userA.id)}
                            aria-expanded={open}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors shrink-0"
                          >
                            More details
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                          </button>}
                        </div>
                        <TargetProgressBar count={count} target={perAgentTarget} />
                        <SaleTypeChips counts={byType} />
                        {open && (
                          <div className="mt-1 pt-3 border-t border-slate-100">
                            <AgentSalesDetails agentId={userA.id} month={month} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {sortedGroup.agents.length === 0 && <div className="p-4 text-sm text-slate-500">No agents in this team.</div>}
                </div>
              </Collapsible>
            );
          })}
        </div>
      </div>

      {/* Sales list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            {isAgent ? 'My sales' : isTeamLeader ? 'Team sales' : isOperationManager ? 'My teams\u2019 sales' : 'Sales'} <span className="text-slate-500 font-normal">({sortedSales.length})</span>
          </h3>
          <SortDirectionButton dir={listDir} onToggle={() => setListDir(previousListDir => (previousListDir === 'desc' ? 'asc' : 'desc'))} label="Date" />
        </div>

        {loadError ? (
          <p className="px-5 py-8 text-sm text-rose-700" role="alert">{loadError} <button onClick={() => void load()} className="underline ml-1">Try again</button></p>
        ) : !overview ? (
          <p className="px-5 py-8 text-sm text-slate-500" role="status">Loading…</p>
        ) : sortedSales.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Trophy className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No sales in {monthLabel(month)}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {salesPage.pageItems.map(sale => {
              const agent = state.users.find(user => user.id === sale.agentId);
              const saleTypeOption = saleTypeConfig(sale.saleType);
              const sameLead = monthSales.filter(monthSale => monthSale.leadId === sale.leadId).length;
              return (
                <div key={sale.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/40">
                  <div className="w-20 text-xs text-slate-600 shrink-0">
                    {new Date(`${sale.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{sale.leadName}</div>
                    <div className="text-xs text-slate-600 truncate">
                      {!isAgent && agent && <>{agent.name} · </>}
                      {sale.campaignCode ?? ''}
                    </div>
                  </div>
                  {sameLead > 1 && <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 shrink-0">{sameLead} sales on this lead</span>}
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${saleTypeOption.chip}`}>{saleTypeOption.label}</span>
                  {isQuality && sale.canDelete && (
                    <button
                      onClick={() => ask(
                        { title: 'Delete this sale?', message: <>The {sale.saleType} sale for <b>{sale.leadName}</b> will be deleted. This can’t be undone.</>, confirmLabel: 'Delete', tone: 'danger' },
                        async () => { if (await dispatch(deleteSale(sale.id))) await load(); },
                      )}
                      className="w-8 h-8 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center shrink-0"
                      title="Delete sale"
                      aria-label="Delete sale"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="px-5 pb-4"><Pagination {...salesPage} onPage={salesPage.setPage} /></div>
      </div>

      {confirmDialog}

      {showForm && isQuality && (
        <RecordSaleModal
          state={state}
          me={currentUser}
          onClose={() => setShowForm(false)}
          onSave={async sale => {
            const warnings = await dispatch(recordSale(sale));
            if (!warnings) return;                           // refused: the banner says why, the form stays open
            if (warnings.includes('DUPLICATE_SALE')) reportError('Saved. Note: this lead already had a sale recorded.');
            // jump to the month of the sale so Quality sees it appear
            if (sale.date.slice(0, 7) === month) await load(); else setMonth(sale.date.slice(0, 7));
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}
