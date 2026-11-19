import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { Workflow } from '@/features/campaigns/types/campaigns.types';
import { campaignLabel } from '@/features/campaigns/utils/campaignLabel';
import { adminLeadsApi } from '@/features/lead-pool/api/adminLeads.api';
import { LeadImportModalShell } from '@/features/lead-pool/components/LeadImportModalShell';
import { cleanLeadCode, isValidEmail, isValidLeadCode } from '@/features/leads/schema/leadCode.schema';
import { errorText } from '@/shared/api/client';
import { TEXT_INPUT_CLASS } from '@/shared/constants/formStyles';

export function AddSingleLeadModal({ workflows, onClose, onDone }: {
  workflows: Workflow[]; onClose: () => void; onDone: () => void;
}) {
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ leadCode: '', companyName: '', contactName: '', phone: '', email: '', campaignCode: workflows[0]?.campaignCode || '' });
  const updateField = (fieldName: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(previousForm => ({ ...previousForm, [fieldName]: event.target.value }));

  const code = cleanLeadCode(form.leadCode);
  const error =
    !code ? '' :
    !isValidLeadCode(code) ? 'Lead ID must contain letters and numbers only' :
    form.email.trim() && !isValidEmail(form.email.trim()) ? 'Invalid email' : '';
  const canAdd = !busy && !!code && !error && !!form.companyName.trim() && !!form.contactName.trim() && !!form.email.trim() && !!form.campaignCode;

  const submit = async () => {
    if (!canAdd) return;
    setBusy(true); setServerError('');
    try {
      await adminLeadsApi.addOne({
        leadCode: code, campaignCode: form.campaignCode, companyName: form.companyName.trim(),
        contactName: form.contactName.trim(), phone: form.phone.trim() || undefined, email: form.email.trim(),
      });
      onDone();
      onClose();
    } catch (caughtError) { setServerError(errorText(caughtError)); setBusy(false); }     // e.g. "this lead ID already exists"
  };

  return (
    <LeadImportModalShell title="Add One Lead" subtitle="It goes to the shared pool" onClose={onClose}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
        <button onClick={submit} disabled={!canAdd} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" />Add Lead
        </button>
      </>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Lead ID *</label><input className={TEXT_INPUT_CLASS} value={form.leadCode} onChange={updateField('leadCode')} autoFocus /></div>
        <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Campaign *</label>
          <select className={TEXT_INPUT_CLASS} value={form.campaignCode} onChange={updateField('campaignCode')}>
            {workflows.map(workflow => <option key={workflow.id} value={workflow.campaignCode}>{campaignLabel(workflows, workflow.campaignCode)}</option>)}
          </select></div>
        <div className="col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1.5">Company *</label><input className={TEXT_INPUT_CLASS} value={form.companyName} onChange={updateField('companyName')} /></div>
        <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Full name *</label><input className={TEXT_INPUT_CLASS} value={form.contactName} onChange={updateField('contactName')} /></div>
        <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Phone (optional)</label><input className={TEXT_INPUT_CLASS} value={form.phone} onChange={updateField('phone')} /></div>
        <div className="col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1.5">Email *</label><input className={TEXT_INPUT_CLASS} value={form.email} onChange={updateField('email')} /></div>
      </div>
      {(error || serverError) && <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2" role="alert">{error || serverError}</p>}
    </LeadImportModalShell>
  );
}
