import { Mail, Pencil, Phone, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { CampaignEditorModal } from '@/features/campaigns/components/CampaignEditorModal';
import { deleteWorkflow, saveWorkflow } from '@/features/campaigns/thunks/campaigns.thunks';
import type { Workflow, WorkflowDraft } from '@/features/campaigns/types/campaigns.types';
import { describeGap, draftStepsFromTemplates } from '@/features/campaigns/utils/workflowDraft';
import { useConfirm } from '@/shared/components/ConfirmDialog';
import { useStore } from '@/store/hooks';

/** Admin: every campaign with its touch points; create a new one or change an existing one. */
export function CampaignsPage() {
  const { state, dispatch } = useStore();
  const [editing, setEditing] = useState<Workflow | 'new' | null>(null);
  const { ask, dialog: confirmDialog } = useConfirm();

  const leadCount = (code: string) => state.workflows.find(workflow => workflow.campaignCode === code)?.leadCount ?? 0;   // counted by the server
  const saveWorkflowDraft = async (workflowDraft: WorkflowDraft) => { if (await dispatch(saveWorkflow({ ...workflowDraft, isNew: editing === 'new' }))) setEditing(null); };
  const askDelete = (workflow: Workflow) => ask(
    { title: 'Delete this campaign?', message: <><b>{workflow.campaignCode} — {workflow.name}</b> will be deleted. No lead uses it.</>, confirmLabel: 'Delete', tone: 'danger' },
    () => dispatch(deleteWorkflow(workflow.campaignCode)),
  );

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Campaigns</h2>
          <p className="text-sm text-slate-600">{state.workflows.length} campaigns · the touch points every lead gets, and the days between them</p>
        </div>
        <button onClick={() => setEditing('new')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" />New Campaign
        </button>
      </div>

      <div className="space-y-4">
        {state.workflows.map(workflow => {
          const count = leadCount(workflow.campaignCode);
          const steps = draftStepsFromTemplates(workflow.touchPoints);
          return (
            <section key={workflow.id} className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <header className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                <span className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{workflow.campaignCode}</span>
                <h3 className="font-semibold text-slate-900">{workflow.name}</h3>
                <span className="text-xs text-slate-500">{steps.length} touch points · {count} lead{count === 1 ? '' : 's'}</span>
                <div className="ml-auto flex gap-1">
                  <button onClick={() => setEditing(workflow)} aria-label={`Edit ${workflow.campaignCode}`} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => askDelete(workflow)} disabled={count > 0} aria-label={`Delete ${workflow.campaignCode}`}
                    title={count > 0 ? 'Leads use this campaign - it cannot be deleted' : 'Delete campaign'}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </header>
              <ol className="px-5 py-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {steps.map((step, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-xs text-slate-500">{index + 1}</span>
                    {step.type === 'call' ? <Phone className="w-3.5 h-3.5 text-blue-600" /> : <Mail className="w-3.5 h-3.5 text-violet-600" />}
                    <span className="font-medium text-slate-800">{step.label}</span>
                    <span className="ml-auto text-xs text-slate-500 text-right">{describeGap(index, step.gapDays)}</span>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>

      {confirmDialog}
      {editing && (
        <CampaignEditorModal
          workflow={editing === 'new' ? null : editing}
          otherCodes={state.workflows.filter(workflow => workflow !== editing).map(workflow => workflow.campaignCode)}
          leadCount={editing === 'new' ? 0 : leadCount(editing.campaignCode)}
          onSave={saveWorkflowDraft} onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
