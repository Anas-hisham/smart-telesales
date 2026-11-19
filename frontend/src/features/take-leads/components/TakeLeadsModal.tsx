import { Download, Search, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { PoolPreviewRow } from '@/features/leads/types/leadPool.types';
import { ClaimResultRow } from '@/features/take-leads/components/ClaimResultRow';
import { usePoolPreview } from '@/features/take-leads/hooks/usePoolPreview';

/**
 * How an agent gets leads. Agents do not create leads - the Admin does. Here the agent either
 *  1) types ONE full lead ID in the search box: the lead appears only when the ID matches exactly (the pool is never listed), or
 *  2) types / pastes lead IDs one under the other and all of them are taken at once.
 * Every ID gets a result: added, not found, or held by another agent (with the name).
 * The server checks the ids (POST /lead-pool/preview) and takes them (POST /lead-pool/take): the pool is never sent to the browser.
 */
export function TakeLeadsModal({
  onTake, onClose,
}: {
  onTake: (leadIds: string[]) => void | Promise<unknown>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'search' | 'paste'>('search');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [text, setText] = useState('');
  const [report, setReport] = useState<PoolPreviewRow[] | null>(null);

  // ---- search tab: the agent must type the FULL id. The server answers only when the id matches exactly ----
  const search = usePoolPreview(tab === 'search' ? query : '');
  const typed = query.trim().length > 0;
  const matchedRow = search.rows[0];
  const pickedRows = search.rows.filter(row => row.status === 'ready' && row.leadId && picked.has(row.leadId));
  const togglePick = (id: string) => setPicked(previousPicked => { const updatedSet = new Set(previousPicked); if (updatedSet.has(id)) updatedSet.delete(id); else updatedSet.add(id); return updatedSet; });

  // ---- paste tab: live check of every ID ----
  const paste = usePoolPreview(tab === 'paste' ? text : '');
  const plan = paste.rows;
  const ready = plan.filter(previewRow => previewRow.status === 'ready');
  const problems = plan.filter(previewRow => previewRow.status !== 'ready');

  const takePicked = async () => {
    const ids = pickedRows.map(pickedRow => pickedRow.leadId!);
    if (!ids.length) return;
    await onTake(ids);
    setReport(pickedRows);
    setPicked(new Set());
    setQuery('');
  };
  const takePasted = async () => {
    if (!ready.length) return;
    await onTake(ready.map(previewRow => previewRow.leadId!));
    setReport(plan);
    setText('');
  };

  const tabClass = (tabName: typeof tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === tabName ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-700'}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-slide-up max-h-[92vh] max-h-[92dvh] flex flex-col">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Take Leads</h2>
            <p className="text-sm text-slate-600">Get leads from the shared pool into your work queue</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center" aria-label="Close">
            <XCircle className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <div className="px-4 sm:px-6 border-b border-slate-100 flex gap-2">
          <button className={tabClass('search')} onClick={() => { setTab('search'); setReport(null); }}>Search by exact ID</button>
          <button className={tabClass('paste')} onClick={() => { setTab('paste'); setReport(null); }}>Type / paste IDs</button>
        </div>

        <div className="px-4 sm:px-6 py-4 overflow-y-auto scrollbar-thin flex-1 space-y-3">
          {report && (
            <div className="rounded-lg border border-slate-200 text-xs" aria-live="polite">
              <div className="px-3 py-2 bg-slate-50 font-medium text-slate-700 rounded-t-lg">
                {report.filter(previewRow => previewRow.status === 'ready').length} added
                {report.some(previewRow => previewRow.status !== 'ready') && ` · ${report.filter(previewRow => previewRow.status !== 'ready').length} not added`}
              </div>
              <ul className="max-h-44 overflow-y-auto scrollbar-thin divide-y divide-slate-100">
                {report.map((previewRow, index) => <ClaimResultRow key={`${previewRow.code}-${index}`} r={previewRow} />)}
              </ul>
            </div>
          )}

          {tab === 'search' && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  value={query} onChange={event => setQuery(event.target.value)} autoFocus
                  placeholder="Type the full lead ID, e.g. LD013"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {!typed && <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2">Leads are not listed. Write the exact ID of the lead you want and it will show up here.</p>}

              {search.error && <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2" role="alert">{search.error}</p>}

              {matchedRow?.status === 'recently_worked' && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  <span className="font-mono">{matchedRow.code}</span> left another agent's queue less than 15 days ago.
                  {' '}{matchedRow.daysLeft} day{matchedRow.daysLeft === 1 ? '' : 's'} left before you can add it.
                </p>
              )}

              {matchedRow?.status === 'ready' && matchedRow.leadId && (
                <label className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={picked.has(matchedRow.leadId)} onChange={() => togglePick(matchedRow.leadId!)} />
                  <span className="font-mono text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">{matchedRow.code}</span>
                  <span className="truncate text-sm text-slate-900">{matchedRow.companyName}</span>
                </label>
              )}

              {matchedRow?.status === 'taken' && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  <span className="font-mono">{matchedRow.code}</span> exists but is held by {matchedRow.holderName ?? 'another agent'}.
                </p>
              )}
              {matchedRow?.status === 'mine' && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2"><span className="font-mono">{matchedRow.code}</span> is already in your queue.</p>
              )}

              {typed && !search.busy && !search.error && (!matchedRow || matchedRow.status === 'not_found' || matchedRow.status === 'invalid') && (
                <p className="text-sm text-slate-500 text-center py-3">No lead with this exact ID in the pool</p>
              )}

              {pickedRows.length > 0 && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/40">
                  <div className="px-3 py-2 text-xs font-medium text-blue-800">Selected ({pickedRows.length})</div>
                  <ul className="divide-y divide-blue-100/70 max-h-40 overflow-y-auto scrollbar-thin">
                    {pickedRows.map(pickedRow => (
                      <li key={pickedRow.leadId} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                        <span className="font-mono text-xs bg-white text-slate-600 px-1.5 py-0.5 rounded shrink-0">{pickedRow.code}</span>
                        <span className="truncate text-slate-800">{pickedRow.companyName}</span>
                        <button onClick={() => togglePick(pickedRow.leadId!)} className="ml-auto text-xs text-slate-500 hover:text-rose-600 shrink-0" aria-label={`Unselect ${pickedRow.code}`}>Remove</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {tab === 'paste' && (
            <>
              <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2">
                Write or paste the lead IDs one under the other. All of them are added automatically - no need to pick each one.
              </p>
              <textarea
                value={text} onChange={event => { setText(event.target.value); setReport(null); }}
                rows={7} autoFocus
                placeholder={'LD012\nLD013\nLD014'}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
              {paste.error && <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2" role="alert">{paste.error}</p>}
              {plan.length > 0 && (
                <div className="text-xs space-y-1.5" aria-live="polite">
                  <p>
                    <span className="font-medium text-emerald-700">{ready.length} ready</span>
                    {problems.length > 0 && <span className="font-medium text-rose-600"> · {problems.length} with a problem</span>}
                  </p>
                  {problems.length > 0 && (
                    <ul className="max-h-32 overflow-y-auto scrollbar-thin rounded-lg bg-rose-50 border border-rose-100 divide-y divide-rose-100">
                      {problems.slice(0, 50).map((problem, index) => <ClaimResultRow key={`${problem.code}-${index}`} r={problem} />)}
                      {problems.length > 50 && <li className="px-3 py-1.5 text-rose-600">…and {problems.length - 50} more</li>}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Close</button>
          {tab === 'search' ? (
            <button onClick={takePicked} disabled={pickedRows.length === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              {pickedRows.length > 0 ? `Take ${pickedRows.length} lead${pickedRows.length === 1 ? '' : 's'}` : 'Take leads'}
            </button>
          ) : (
            <button onClick={takePasted} disabled={ready.length === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              {ready.length > 0 ? `Take ${ready.length} lead${ready.length === 1 ? '' : 's'}` : 'Take leads'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
