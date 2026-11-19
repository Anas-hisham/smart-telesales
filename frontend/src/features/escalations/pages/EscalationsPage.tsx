import { ArrowUpRight, CheckCircle2, Flag, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { escalationsApi } from '@/features/escalations/api/escalations.api';
import { EscalationActionModal } from '@/features/escalations/components/EscalationActionModal';
import { NewEscalationModal } from '@/features/escalations/components/NewEscalationModal';
import { createEscalation, forwardEscalation, resolveEscalation } from '@/features/escalations/thunks/escalations.thunks';
import type { Escalation } from '@/features/escalations/types/escalations.types';
import type { User } from '@/features/users/types/users.types';
import { roleLabel } from '@/shared/lib/roleLabel';
import { useStore } from '@/store/hooks';

type Tab = 'inbox' | 'sent' | 'all';

/** Raise a problem about somebody and send it up; the person who holds it passes it higher or closes it. */
export function EscalationsPage() {
  const { state, dispatch } = useStore();
  const currentUser = state.users.find(user => user.id === state.currentUserId)!;
  const [tab, setTab] = useState<Tab>(currentUser.role === 'admin' ? 'all' : 'inbox');
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState<{ e: Escalation; mode: 'forward' | 'resolve' } | null>(null);

  const visible = state.escalations;   // the server sends only what this person may see (never the ones about him)

  // the people this person may raise a problem about (GET /escalations/subjects)
  const [subjects, setSubjects] = useState<User[]>([]);
  useEffect(() => { if (currentUser.role !== 'admin') escalationsApi.subjects().then(setSubjects).catch(() => setSubjects([])); }, [currentUser.role]);
  const shown = visible.filter(escalation => tab === 'inbox' ? escalation.status === 'open' && escalation.handlerId === currentUser.id : tab === 'sent' ? escalation.authorId === currentUser.id : true);
  const waiting = visible.filter(escalation => escalation.status === 'open' && escalation.handlerId === currentUser.id).length;
  const canRaise = subjects.length > 0;
  const roleLabelOfUserId = (id: string) => roleLabel(state.users.find(user => user.id === id)?.role ?? '');
  const formatDateTime = (isoDate: string) => new Date(isoDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const tabClass = (tabName: Tab) => `px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === tabName ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-700'}`;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Escalations</h2>
          <p className="text-sm text-slate-600">{waiting > 0 ? `${waiting} waiting for you` : 'Nothing is waiting for you'} · {visible.length} in total</p>
        </div>
        {currentUser.role !== 'admin' && (
          <button onClick={() => setCreating(true)} disabled={!canRaise}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 disabled:opacity-40 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />New Escalation
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-200 mb-4">
        {currentUser.role !== 'admin' && <button className={tabClass('inbox')} onClick={() => setTab('inbox')}>Waiting for me{waiting > 0 && ` (${waiting})`}</button>}
        {currentUser.role !== 'admin' && <button className={tabClass('sent')} onClick={() => setTab('sent')}>Sent by me</button>}
        <button className={tabClass('all')} onClick={() => setTab('all')}>{currentUser.role === 'admin' ? 'All escalations' : 'Everything I can see'}</button>
      </div>

      {shown.length === 0 && (
        <div className="text-center text-slate-500 py-14"><Flag className="w-10 h-10 mx-auto mb-2 opacity-30" />No escalations here</div>
      )}

      <div className="space-y-3">
        {shown.map(escalation => {
          const mine = escalation.status === 'open' && (escalation.myActions?.canResolve ?? escalation.handlerId === currentUser.id);
          const targets = escalation.myActions?.forwardTargets ?? [];
          const handler = state.users.find(user => user.id === escalation.handlerId);
          return (
            <article key={escalation.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-slate-900">{escalation.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    About <b className="font-medium text-slate-700">{escalation.aboutName}</b> ({roleLabelOfUserId(escalation.aboutId)}) · from <b className="font-medium text-slate-700">{escalation.authorName}</b> · {formatDateTime(escalation.createdAt)}
                  </p>
                </div>
                {escalation.status === 'resolved'
                  ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Resolved</span>
                  : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">With {handler?.name ?? '—'}</span>}
              </div>
              <p className="text-sm text-slate-700 mt-3 whitespace-pre-wrap">{escalation.details}</p>

              <ol className="mt-3 border-l-2 border-slate-100 pl-3 space-y-1.5">
                {escalation.steps.map(step => (
                  <li key={step.id} className="text-xs text-slate-600">
                    <b className="font-medium text-slate-800">{step.byName}</b>{' '}
                    {step.action === 'created' ? 'escalated to' : step.action === 'forwarded' ? 'passed it to' : 'resolved it'}
                    {step.toName && <> <b className="font-medium text-slate-800">{step.toName}</b></>}
                    <span className="text-slate-400"> · {formatDateTime(step.at)}</span>
                    {step.note && <div className="text-slate-700 bg-slate-50 rounded-lg px-2 py-1 mt-0.5">{step.note}</div>}
                  </li>
                ))}
              </ol>

              {mine && (
                <div className="flex gap-2 mt-4">
                  {targets.length > 0 && (
                    <button onClick={() => setActing({ e: escalation, mode: 'forward' })} className="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 flex items-center gap-1.5">
                      <ArrowUpRight className="w-3.5 h-3.5" />Pass it up
                    </button>
                  )}
                  <button onClick={() => setActing({ e: escalation, mode: 'resolve' })} className="px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />Resolve
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {creating && (
        <NewEscalationModal subjects={subjects} users={state.users} teams={state.teams} onClose={() => setCreating(false)}
          onSend={newEscalation => { void dispatch(createEscalation(newEscalation)); setCreating(false); setTab('sent'); }} />
      )}
      {acting && (
        <EscalationActionModal mode={acting.mode} title={acting.e.title}
          targets={acting.e.myActions?.forwardTargets ?? []}
          onClose={() => setActing(null)}
          onForward={(toId, note) => { dispatch(forwardEscalation({ id: acting.e.id, toId, note })); setActing(null); }}
          onResolve={note => { dispatch(resolveEscalation({ id: acting.e.id, note })); setActing(null); }} />
      )}
    </div>
  );
}
