import { Plus, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Workflow } from '@/features/campaigns/types/campaigns.types';
import { campaignLabel } from '@/features/campaigns/utils/campaignLabel';
import { adminLeadsApi } from '@/features/lead-pool/api/adminLeads.api';
import { LeadImportModalShell } from '@/features/lead-pool/components/LeadImportModalShell';
import { ADMIN_PASTE_COLUMNS } from '@/features/lead-pool/constants/leadPool.constants';
import type { ImportParse } from '@/features/lead-pool/types/adminLeads.types';
import { errorText } from '@/shared/api/client';
import { TEXT_INPUT_CLASS } from '@/shared/constants/formStyles';

/** The server reads the pasted rows (POST /admin/leads/import/preview) and saves them (POST /admin/leads/import). */
export function PasteLeadsModal({ workflows, onClose, onDone }: {
  workflows: Workflow[]; onClose: () => void; onDone: () => void;
}) {
  const [campaign, setCampaign] = useState(workflows[0]?.campaignCode || '');
  const [text, setText] = useState('');
  const [added, setAdded] = useState(0);
  const [parsed, setParsed] = useState<ImportParse>({ accepted: [], rejected: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // check the rows with the server a moment after typing (it knows which lead ids already exist)
  useEffect(() => {
    if (!text.trim() || !campaign) { setParsed({ accepted: [], rejected: [] }); setError(''); return; }
    let stale = false;
    const timeoutId = setTimeout(async () => {
      try { const previewResult = await adminLeadsApi.importPreview(campaign, text); if (!stale) { setParsed(previewResult); setError(''); } }
      catch (caughtError) { if (!stale) setError(errorText(caughtError)); }
    }, 400);
    return () => { stale = true; clearTimeout(timeoutId); };
  }, [text, campaign]);

  const handleAdd = async () => {
    if (!parsed.accepted.length || busy) return;
    setBusy(true);
    try {
      const result = await adminLeadsApi.import(campaign, text);
      setAdded(previousAdded => previousAdded + result.created);
      onDone();
      if (result.rejected.length === 0) onClose(); else { setText(result.rejected.map(rejectedRow => rejectedRow.raw ?? '').join('\n')); setParsed({ accepted: [], rejected: result.rejected }); }
    } catch (caughtError) { setError(errorText(caughtError)); }
    finally { setBusy(false); }
  };

  return (
    <LeadImportModalShell title="Paste Leads" subtitle="They go to the shared pool - no agent yet" onClose={onClose}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
        <button onClick={handleAdd} disabled={parsed.accepted.length === 0 || busy}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" />{parsed.accepted.length > 0 ? `Add ${parsed.accepted.length} lead${parsed.accepted.length === 1 ? '' : 's'}` : 'Add Leads'}
        </button>
      </>}>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Campaign</label>
        <select value={campaign} onChange={event => setCampaign(event.target.value)} className={TEXT_INPUT_CLASS}>
          {workflows.map(workflow => <option key={workflow.id} value={workflow.campaignCode}>{campaignLabel(workflows, workflow.campaignCode)}</option>)}
        </select>
        <p className="text-xs text-slate-500 mt-1">Every lead you paste goes into this campaign.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5"><Upload className="w-3.5 h-3.5 inline mr-1" />Paste lead rows</label>
        <div className="text-xs text-slate-500 mb-2 bg-slate-50 rounded-lg p-2">
          {ADMIN_PASTE_COLUMNS.join(' [Tab] ')}
          <br />One lead per line. Everything is required except the phone, which is the last column and can be left out.
          The ID must be letters and numbers only and must not exist yet.
        </div>
        <textarea value={text} onChange={event => setText(event.target.value)} rows={8}
          placeholder={'LD101\tTechCorp\tJohn Smith\tjohn@techcorp.com\t+20 100 111 2222\nLD102\tDataSys\tJane Doe\tjane@datasys.com'}
          className={`${TEXT_INPUT_CLASS} font-mono resize-none`} />
        {error && <p className="mt-2 text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2" role="alert">{error}</p>}
        {added > 0 && <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{added} lead{added === 1 ? '' : 's'} added to the pool. The rows below need fixing.</p>}
        {text.trim() && (
          <div className="mt-2 text-xs space-y-1.5" aria-live="polite">
            <p><span className="font-medium text-emerald-700">{parsed.accepted.length} ready</span>
              {parsed.rejected.length > 0 && <span className="font-medium text-rose-600"> · {parsed.rejected.length} with a problem</span>}</p>
            {parsed.rejected.length > 0 && (
              <ul className="max-h-32 overflow-y-auto scrollbar-thin rounded-lg bg-rose-50 border border-rose-100 divide-y divide-rose-100">
                {parsed.rejected.slice(0, 50).map(rejectedRow => (
                  <li key={`${rejectedRow.line}-${rejectedRow.leadCode}`} className="px-3 py-1.5 text-rose-700"><span className="font-mono">Line {rejectedRow.line}{rejectedRow.leadCode ? ` · ${rejectedRow.leadCode}` : ''}</span> — {rejectedRow.reason}</li>
                ))}
                {parsed.rejected.length > 50 && <li className="px-3 py-1.5 text-rose-600">…and {parsed.rejected.length - 50} more</li>}
              </ul>
            )}
          </div>
        )}
      </div>
    </LeadImportModalShell>
  );
}
