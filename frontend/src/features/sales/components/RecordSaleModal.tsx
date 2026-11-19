
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { leadsApi } from '@/features/leads/api/leads.api';
import type { ApiLead } from '@/features/leads/types/leads.types';
import { SALE_TYPES } from '@/features/sales/constants/sales.constants';
import type { SaleType } from '@/features/sales/types/sales.types';
import type { User } from '@/features/users/types/users.types';
import { reportError } from '@/shared/api/apiErrors';
import { AgentPicker } from '@/shared/components/AgentPicker';
import { LeadPicker } from '@/shared/components/LeadPicker';
import { localDateStr } from '@/shared/lib/dates';
import type { AppState } from '@/store/types';

// ---------------------------------------------------------------------------
// Quality: record a sale (agent, lead, sale type, date)
// ---------------------------------------------------------------------------
export function RecordSaleModal({
  state, me: currentUser, onClose, onSave,
}: {
  state: AppState;
  me: User;
  onClose: () => void;
  onSave: (sale: {
    agentId: string;
    leadId: string;
    saleType: SaleType;
    date: string;
  }) => Promise<void>;
}) {
  const agents = state.users.filter(
    candidateUser => candidateUser.role === 'agent' && candidateUser.qualityId === currentUser.id
  );

  const [agentId, setAgentId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [saleType, setSaleType] = useState<SaleType | ''>('');
  const [date, setDate] = useState(localDateStr());

  // Prevent multiple save clicks
  const [isSaving, setIsSaving] = useState(false);

  // The leads of the chosen agent come from the server
  const [agentLeads, setAgentLeads] = useState<ApiLead[]>([]);

  useEffect(() => {
    if (!agentId) {
      setAgentLeads([]);
      return;
    }

    let stale = false;

    (async () => {
      const fetchedLeads: ApiLead[] = [];

      for (let page = 1; page <= 5; page++) {
        const pageResult = await leadsApi.list({
          agentId,
          pageSize: 200,
          page,
        });

        fetchedLeads.push(...pageResult.items);

        if (fetchedLeads.length >= pageResult.total || pageResult.items.length === 0) break;
      }

      if (!stale) setAgentLeads(fetchedLeads);
    })().catch(error => {
      if (!stale) {
        setAgentLeads([]);
        reportError(error);
      }
    });

    return () => {
      stale = true;
    };
  }, [agentId]);

  const pickedLead = agentLeads.find(candidateLead => candidateLead.id === leadId);

  // A lead nobody has talked to may be the wrong one
  const neverReached =
    !!pickedLead &&
    !pickedLead.discoveryReached &&
    pickedLead.queueCategory !== 'discovery';

  const canSave =
    !!agentId &&
    !!pickedLead &&
    !!saleType &&
    !!date;

  const handleSave = async () => {
    if (!canSave || !saleType || isSaving) return;

    try {
      setIsSaving(true);

      await onSave({
        agentId,
        leadId,
        saleType,
        date,
      });
    } catch (error) {
      reportError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const input =
    'w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-slide-up max-h-[92vh] max-h-[92dvh] overflow-y-auto scrollbar-thin">

        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-slate-900">
            Record Sale
          </h2>

          <button
            onClick={onClose}
            disabled={isSaving}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center disabled:opacity-40"
          >
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-5 space-y-4">

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Agent
            </label>

            <AgentPicker
              agents={agents}
              teams={state.teams}
              value={agentId}
              onChange={id => {
                setAgentId(id);
                setLeadId('');
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Lead
            </label>

            {agentId ? (
              <LeadPicker
                leads={agentLeads}
                value={leadId}
                onChange={setLeadId}
                placeholder="Search this agent's leads..."
              />
            ) : (
              <div className="px-4 py-2.5 rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
                Choose an agent first
              </div>
            )}

            {pickedLead && (
              <div className="mt-1.5 text-xs text-slate-600">
                {pickedLead.leadCode} · {pickedLead.campaignCode}
              </div>
            )}

            {neverReached && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                Nobody has spoken to this lead yet (no Discovery call or meeting). Check that this is the right lead before saving.
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Sale type
            </label>

            <select
              value={saleType}
              onChange={event =>
                setSaleType(event.target.value as SaleType | '')
              }
              className={input}
            >
              <option value="">Select sale type...</option>

              {SALE_TYPES.map(saleTypeChoice => (
                <option key={saleTypeChoice.value} value={saleTypeChoice.value}>
                  {saleTypeChoice.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Sale date
            </label>

            <input
              type="date"
              value={date}
              max={localDateStr()}
              onChange={event => setDate(event.target.value)}
              className={input}
            />
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 flex justify-end gap-2 sticky bottom-0 bg-white">

          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isSaving && (
              <span className="animate-spin">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
              </span>
            )}

            {isSaving ? 'Saving...' : 'Save Sale'}
          </button>
        </div>
      </div>
    </div>
  );
}
