import { Building2, ChevronLeft, ChevronRight, Database, Plus, Search, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { campaignLabel } from '@/features/campaigns/utils/campaignLabel';
import { adminLeadsApi } from '@/features/lead-pool/api/adminLeads.api';
import { AddSingleLeadModal } from '@/features/lead-pool/components/AddSingleLeadModal';
import { PasteLeadsModal } from '@/features/lead-pool/components/PasteLeadsModal';
import type { AdminLeadPage } from '@/features/lead-pool/types/adminLeads.types';
import { reportError } from '@/shared/api/apiErrors';
import { errorText } from '@/shared/api/client';
import { useConfirm } from '@/shared/components/ConfirmDialog';
import { useStore } from '@/store/hooks';

const PAGE_SIZE = 50;

/** The Admin's view of ALL leads. The server searches, filters and pages (GET /admin/leads), so the browser never holds the whole pool. */
export function LeadPoolPage() {
  const { state } = useStore();
  const [showPaste, setShowPaste] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pool' | 'assigned'>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminLeadPage | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { ask, dialog: confirmDialog } = useConfirm();

  const load = useCallback(async () => {
    try { setData(await adminLeadsApi.list({ q: searchQuery.trim() || undefined, filter, page, pageSize: PAGE_SIZE })); setError(''); }
    catch (caughtError) { setError(errorText(caughtError)); }
  }, [searchQuery, filter, page]);

  // search a moment after typing; any filter change goes back to page 1
  useEffect(() => { const timeoutId = setTimeout(() => { void load(); }, 300); return () => clearTimeout(timeoutId); }, [load]);
  useEffect(() => { setPage(1); }, [searchQuery, filter]);

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // the Admin can delete any lead, even one with a recorded sale
  const deletable = rows;
  const allShownSelected = deletable.length > 0 && deletable.every(leadRow => selected.has(leadRow.id));
  const toggle = (id: string) => setSelected(previousSelected => { const updatedSet = new Set(previousSelected); if (updatedSet.has(id)) updatedSet.delete(id); else updatedSet.add(id); return updatedSet; });
  const toggleAll = () => setSelected(previousSelected => {
    const updatedSet = new Set(previousSelected);
    if (allShownSelected) deletable.forEach(leadRow => updatedSet.delete(leadRow.id)); else deletable.forEach(leadRow => updatedSet.add(leadRow.id));
    return updatedSet;
  });

  const deleteLeads = async (ids: string[]) => {
    try {
      const result = await adminLeadsApi.remove(ids);
      if (result.skipped.length) reportError(`${result.skipped.length} lead${result.skipped.length === 1 ? ' was' : 's were'} not deleted (already gone).`);
      setSelected(previousSelected => { const nextSet = new Set(previousSelected); ids.forEach(id => nextSet.delete(id)); return nextSet; });
      await load();
    } catch (caughtError) { reportError(caughtError); }
  };
  const selectedHaveSale = (ids: string[]) => rows.some(row => ids.includes(row.id) && row.hasSale);
  const askDelete = (ids: string[]) => {
    const count = ids.length;
    const only = count === 1 ? rows.find(row => row.id === ids[0]) : undefined;
    ask(
      {
        title: count === 1 ? 'Delete this lead?' : `Delete ${count} leads?`,
        message: <>{only ? <><b>{only.leadCode} — {only.companyName}</b> will be</> : <>These {count} leads will be</>} deleted permanently, with their call history and activity log. Their arranged meetings will be cancelled. {selectedHaveSale(ids) && <>At least one of them has a recorded sale: make sure that is what you want. </>}This can’t be undone.</>,
        confirmLabel: 'Delete permanently', tone: 'danger',
      },
      () => deleteLeads(ids),
    );
  };
  const selectedIds = [...selected];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Lead Pool</h2>
          <p className="text-sm text-slate-600">
            {data ? `${data.poolCount + data.assignedCount} leads · ${data.poolCount} waiting in the pool for an agent` : 'Loading…'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <button onClick={() => askDelete(selectedIds)} className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />Delete selected ({selectedIds.length})
            </button>
          )}
          <button onClick={() => setShowForm(true)} className="px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />Add One Lead
          </button>
          <button onClick={() => setShowPaste(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" />Paste Leads
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search by lead ID, company, contact or email..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <select value={filter} onChange={event => setFilter(event.target.value as typeof filter)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
          <option value="all">All leads</option>
          <option value="pool">In the pool</option>
          <option value="assigned">Held by an agent</option>
        </select>
      </div>

      {error && <p className="mb-3 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-3" role="alert">{error}</p>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allShownSelected} onChange={toggleAll} disabled={deletable.length === 0} aria-label="Select all shown leads" />
                </th>
                {['Lead ID', 'Company', 'Contact', 'Phone', 'Email', 'Campaign', 'Held by'].map(heading => (
                  <th key={heading} className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{heading}</th>
                ))}
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data && rows.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                  <Database className="w-10 h-10 mx-auto mb-2 opacity-30" />No leads found
                </td></tr>
              )}
              {rows.map(row => (
                <tr key={row.id} className={`hover:bg-slate-50/30 ${selected.has(row.id) ? 'bg-blue-50/40' : ''}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)}
                      aria-label={`Select ${row.leadCode}`} />
                  </td>
                  <td className="px-4 py-3"><span className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{row.leadCode}</span></td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900"><span className="inline-flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-slate-500" />{row.companyName}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-700">{row.contactName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{row.phone || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{row.email || '—'}</td>
                  <td className="px-4 py-3"><span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{campaignLabel(state.workflows, row.campaignCode)}</span></td>
                  <td className="px-4 py-3">
                    {row.inPool
                      ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">{row.round > 1 ? 'Back in pool' : 'In pool'}</span>
                      : <span className="text-sm text-slate-700">{row.agentName ?? '—'}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => askDelete([row.id])}
                      title="Delete lead" aria-label={`Delete ${row.leadCode}`}
                      className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > PAGE_SIZE && (
          <div className="px-4 py-2 text-xs text-slate-600 border-t border-slate-100 flex items-center justify-between">
            <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
            <span className="flex items-center gap-1">
              <button onClick={() => setPage(previousPage => Math.max(1, previousPage - 1))} disabled={page <= 1} className="w-7 h-7 rounded-lg hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center" aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
              <span>Page {page} / {pages}</span>
              <button onClick={() => setPage(previousPage => Math.min(pages, previousPage + 1))} disabled={page >= pages} className="w-7 h-7 rounded-lg hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center" aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
            </span>
          </div>
        )}
      </div>

      {confirmDialog}

      {showPaste && <PasteLeadsModal workflows={state.workflows} onClose={() => setShowPaste(false)} onDone={() => void load()} />}
      {showForm && <AddSingleLeadModal workflows={state.workflows} onClose={() => setShowForm(false)} onDone={() => void load()} />}
    </div>
  );
}
