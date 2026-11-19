import { useState } from 'react';
import { LeadImportModalShell } from '@/features/lead-pool/components/LeadImportModalShell';
import type { User } from '@/features/users/types/users.types';
import { TEXT_INPUT_CLASS } from '@/shared/constants/formStyles';
import { roleLabel } from '@/shared/lib/roleLabel';

/** The person who holds an escalation either passes it up (with a note) or closes it (with an answer). */
export function EscalationActionModal({ mode, title, targets, onForward, onResolve, onClose }: {
  mode: 'forward' | 'resolve'; title: string; targets: User[];
  onForward: (toId: string, note: string) => void; onResolve: (note: string) => void; onClose: () => void;
}) {
  const [toId, setToId] = useState(targets[0]?.id ?? '');
  const [note, setNote] = useState('');
  const forward = mode === 'forward';
  return (
    <LeadImportModalShell title={forward ? 'Pass it up' : 'Resolve escalation'} subtitle={title} onClose={onClose}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
        <button onClick={() => (forward ? onForward(toId, note) : onResolve(note))} disabled={forward ? !toId : !note.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40">{forward ? 'Pass it up' : 'Resolve'}</button>
      </>}>
      {forward && (
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Send it to</span>
          <select value={toId} onChange={event => setToId(event.target.value)} className={`${TEXT_INPUT_CLASS} mt-1`}>
            {targets.map(target => <option key={target.id} value={target.id}>{target.name} · {roleLabel(target.role)}</option>)}
          </select>
        </label>
      )}
      <label className="block">
        <span className="text-xs font-semibold text-slate-600">{forward ? 'Note (optional)' : 'What was done? *'}</span>
        <textarea value={note} onChange={event => setNote(event.target.value)} rows={3} className={`${TEXT_INPUT_CLASS} mt-1 resize-none`} />
      </label>
    </LeadImportModalShell>
  );
}
