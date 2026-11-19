import { AlertTriangle, Info } from 'lucide-react';
import { useState } from 'react';
import { GroupPerformanceTable } from '@/features/analytics/components/GroupPerformanceTable';
import { HorizontalBar } from '@/features/analytics/components/HorizontalBar';
import { KpiCard } from '@/features/analytics/components/KpiCard';
import { PeriodPicker } from '@/features/analytics/components/PeriodPicker';
import { CARD_CLASS } from '@/features/analytics/constants/analyticsStyles';
import { groupRow, toPercent, useAnalytics } from '@/features/analytics/hooks/useAnalytics';
import type { DateRange, PeriodPreset } from '@/features/analytics/types/analytics.types';
import { percent } from '@/features/analytics/utils/metrics';
import { campaignLabel } from '@/features/campaigns/utils/campaignLabel';
import { localDateStr } from '@/shared/lib/dates';
import { useStore } from '@/store/hooks';

export function AnalyticsPage() {
  const { state } = useStore();
  const currentUser = state.users.find(user => user.id === state.currentUserId);
  const [campaign, setCampaign] = useState('all');
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [custom, setCustom] = useState<DateRange>({ from: localDateStr(), to: localDateStr() });
  const isAgent = currentUser?.role === 'agent';

  // Everything below is counted by the server (GET /analytics) for this person's scope:
  // an agent sees his own numbers, a Team Leader his team, an Operation Manager the teams he manages.
  const { report, error, loading } = useAnalytics(preset, custom, campaign);

  const campaigns = state.workflows.map(workflow => workflow.campaignCode);
  const campaignLabelOf = (campaignCode: string) => campaignLabel(state.workflows, campaignCode);

  const emptyCalls = { calls: 0, nvm: 0, lvm: 0, discovery: 0, answerRate: 0, reachRate: 0 };
  const calls = report ? { ...report.calls, answerRate: toPercent(report.calls.answerRate), reachRate: toPercent(report.calls.reachRate) } : emptyCalls;
  const funnel = report?.funnel ?? { leads: 0, contacted: 0, reached: 0, meetings: 0, sold: 0 };
  const salesCount = report?.salesCount ?? 0;
  const campaignRows = (report?.campaigns ?? []).map(row => ({ ...groupRow(row), label: campaignLabelOf(row.key) }));
  const agentRows = (report?.agents ?? []).map(groupRow);
  // only the hours with calls are listed
  const hours = (report?.hours ?? []).filter(hourStats => hourStats.calls > 0).map(hourStats => ({ ...hourStats, reachRate: toPercent(hourStats.reachRate) }));
  const reasons = (report?.reasons ?? []).map(reasonRow => ({ ...reasonRow, share: toPercent(reasonRow.share) }));
  const issues = report?.dataQuality ?? [];

  // the target the server sends is scaled to the length of the period (the monthly target of one agent is SALES_TARGET_PER_AGENT)
  const target = report?.salesTarget ?? 0;
  const periodName = { today: 'today', week: 'this week', month: 'this month', custom: 'the selected period' }[preset];
  const rangeText = !report ? '' : report.range.from === report.range.to ? report.range.from : `${report.range.from} → ${report.range.to}`;
  const bestHour = [...hours].filter(hour => hour.calls >= 2).sort((hourA, hourB) => hourB.reachRate - hourA.reachRate || hourB.calls - hourA.calls)[0];

  // What happened on the calls (the number of leads is deliberately not shown: only calls and their results matter)
  const callResults: [string, number, string][] = [
    ['No answer (NVM)', calls.nvm, 'bg-slate-400'],
    ['Answered, wrong person / voicemail (LVM)', calls.lvm, 'bg-amber-500'],
    ['Reached the right person (Discovery)', calls.discovery, 'bg-emerald-500'],
  ];

  if (!currentUser) return null;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{isAgent ? 'My Analytics' : 'Analytics'}</h1>
          <p className="text-sm text-slate-600">
            {isAgent ? 'Your own numbers' : currentUser.role === 'team_leader' ? 'Your team' : 'All your teams'} · {calls.calls} calls · {rangeText}{loading && ' · updating…'}
          </p>
        </div>
        {error && <p className="basis-full text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2" role="alert">{error}</p>}
        <PeriodPicker preset={preset} custom={custom} onPreset={setPreset} onCustom={setCustom} />
        <select
          value={campaign} onChange={event => setCampaign(event.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All campaigns</option>
          {campaigns.map(campaignCode => <option key={campaignCode} value={campaignCode}>{campaignCode} · {campaignLabelOf(campaignCode)}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Calls made" value={String(calls.calls)} hint={`${calls.nvm} NVM · ${calls.lvm} LVM · ${calls.discovery} Discovery`} />
        <KpiCard label="Answered" value={String(calls.lvm + calls.discovery)} hint={`Answer rate ${calls.answerRate}% of calls`} />
        <KpiCard label="Reached (Discovery)" value={String(calls.discovery)} hint={`Reach rate ${calls.reachRate}% of calls`} />
        <KpiCard label={`Sales ${periodName}`} value={`${salesCount} / ${target}`} hint={`${percent(salesCount, target)}% of the target for this period`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className={CARD_CLASS}>
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Call results</h2>
          <div className="space-y-3">
            {callResults.map(([name, count, color]) => (
              <div key={name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-700">{name}</span>
                  <span className="text-slate-600">{count} · {percent(count, calls.calls)}% of calls</span>
                </div>
                <HorizontalBar value={count} max={calls.calls} color={color} />
              </div>
            ))}
            {calls.calls === 0 && <div className="text-sm text-slate-500">No calls in this period.</div>}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
            <span>Meetings arranged: <b className="text-slate-900">{funnel.meetings}</b></span>
            <span>Sales: <b className="text-slate-900">{salesCount}</b></span>
          </div>
        </div>

        <div className={CARD_CLASS}>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Best time to call</h2>
          <p className="text-xs text-slate-600 mb-4">
            {bestHour ? `Highest reach rate: around ${bestHour.hour}:00 (${bestHour.reachRate}% of ${bestHour.calls} calls).` : 'Needs at least 2 calls in the same hour.'}
          </p>
          <div className="space-y-2.5">
            {hours.map(hour => (
              <div key={hour.hour} className="flex items-center gap-3">
                <div className="w-12 text-xs text-slate-600">{String(hour.hour).padStart(2, '0')}:00</div>
                <div className="flex-1"><HorizontalBar value={hour.reachRate} max={100} color="bg-cyan-500" /></div>
                <div className="w-28 text-xs text-slate-600 text-right">{hour.reachRate}% of {hour.calls} calls</div>
              </div>
            ))}
            {hours.length === 0 && <div className="text-sm text-slate-500">No calls in this period.</div>}
          </div>
        </div>
      </div>

      <div className={CARD_CLASS}>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">Campaigns</h2>
        <GroupPerformanceTable rows={campaignRows} first="Campaign" />
      </div>

      {!isAgent && (
        <div className={CARD_CLASS}>
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Agents</h2>
          <GroupPerformanceTable rows={agentRows} first="Agent" />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className={CARD_CLASS}>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">What agents report on calls</h2>
          <p className="text-xs text-slate-600 mb-4">Taken from the outcome reason the agent chose when logging the call.</p>
          <div className="space-y-3">
            {reasons.map(reason => (
              <div key={reason.reason}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-700">{reason.label}</span>
                  <span className="text-slate-600">{reason.count} · {reason.share}%</span>
                </div>
                <HorizontalBar value={reason.count} max={reasons[0]?.count ?? 1} color="bg-cyan-500" />
              </div>
            ))}
            {reasons.length === 0 && <div className="text-sm text-slate-500">No calls in this period.</div>}
          </div>
        </div>

        {!isAgent && (
          <div className={CARD_CLASS}>
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Data quality</h2>
            <div className="space-y-2.5">
              {issues.map(issue => (
                <div key={issue.id} className={`flex gap-2.5 text-sm rounded-lg px-3 py-2.5 ${issue.level === 'warn' ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-700'}`}>
                  {issue.level === 'warn' ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> : <Info className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span>{issue.text}</span>
                </div>
              ))}
              {issues.length === 0 && <div className="text-sm text-slate-600">No problems found in the data.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
