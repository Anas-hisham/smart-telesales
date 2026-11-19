import { Ban, Calendar, CheckCircle2, Mail, MoreVertical, PauseCircle, Phone, Play, SkipForward, Undo2, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { TouchPoint } from '@/features/campaigns/types/campaigns.types';
import { useLeadDetail } from '@/features/leads/hooks/useLeadDetail';
import type { Lead } from '@/features/leads/types/leads.types';
import { queueCategory } from '@/features/leads/utils/callClassification';
import { describeDueDate, isOpenTouchPoint } from '@/features/leads/utils/touchPoints';
import { QUEUE_CATEGORY_STYLE } from '@/features/work-queue/constants/queueStyles';
import { LEAD_STATUS_STYLE } from '@/shared/constants/leadStatusStyles';

export function LeadDetailDrawer({
  lead, onClose, onMarkComplete, onSkip, onRestore, onStop, onResume, onRemove, agentName,
}: {
  lead: Lead;
  onClose: () => void;
  onMarkComplete: (touchPoint: TouchPoint) => void;
  onSkip: (touchPoint: TouchPoint) => void;
  onRestore: (touchPoint: TouchPoint) => void;
  onStop: () => void;
  onResume: () => void;
  onRemove: () => void;
  agentName: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  useLeadDetail(lead);   // call logs + history come from GET /leads/:id
  const config = LEAD_STATUS_STYLE[lead.status];
  const category = queueCategory(lead);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto scrollbar-thin animate-slide-in shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-4 sm:px-6 py-4 z-10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{lead.leadCode}</h2>
            <p className="text-sm text-slate-600">{lead.companyName} • {lead.contactName}</p>
          </div>
          <div className="flex items-center gap-2">
            {lead.stopped && <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700">Stopped</span>}
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${config.color}`}>{config.label}</span>
            <div className="relative">
              <button onClick={() => setMenuOpen(previousMenuOpen => !previousMenuOpen)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <MoreVertical className="w-4 h-4 text-slate-600" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-slate-200 z-20 py-1">
                  {lead.stopped ? (
                    <>
                      <button onClick={() => { onResume(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50">
                        <Play className="w-3.5 h-3.5" /> Resume Workflow
                      </button>
                      <button onClick={() => { onRemove(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
                        <XCircle className="w-3.5 h-3.5" /> Remove from Queue
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { onStop(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50">
                        <Ban className="w-3.5 h-3.5" /> Stop Workflow
                      </button>
                      <button onClick={() => { onRemove(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
                        <XCircle className="w-3.5 h-3.5" /> Remove from Queue
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
              <XCircle className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        {lead.stopped && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-3">
            <PauseCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800 flex-1">This workflow is stopped. Resume it to bring the lead back to the queue, or remove it from your queue.</p>
            <button onClick={onResume} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 shrink-0">Resume</button>
          </div>
        )}

        {/* Contact info */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500 mb-1">Phone</div>
              <div className="text-sm text-slate-900">{lead.phone || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Email</div>
              <div className="text-sm text-slate-900 truncate">{lead.email || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Agent</div>
              <div className="text-sm text-slate-900">{agentName}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Queue category</div>
              <div className="text-sm text-slate-900">{QUEUE_CATEGORY_STYLE[category].label}</div>
            </div>
          </div>
        </div>

        {/* Touch points timeline */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Workflow Touch Points</h3>
          <div className="space-y-2">
            {lead.touchPoints.map(touchPoint => {
              const isCurrent = touchPoint.order === lead.currentTouchPoint;
              const skipped = touchPoint.status === 'skipped';
              const open = isOpenTouchPoint(touchPoint);
              const due = describeDueDate(open ? touchPoint : undefined);
              const overdue = due.tone === 'overdue';
              return (
                <div
                  key={touchPoint.order}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isCurrent && !lead.stopped ? 'border-blue-300 bg-blue-50/50' : 'border-slate-100'
                  } ${skipped ? 'opacity-70' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    touchPoint.status === 'completed' ? 'bg-emerald-100' : overdue ? 'bg-rose-100' : 'bg-slate-100'
                  }`}>
                    {touchPoint.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : skipped ? (
                      <SkipForward className="w-4 h-4 text-slate-500" />
                    ) : touchPoint.type === 'call' ? (
                      <Phone className={`w-4 h-4 ${overdue ? 'text-rose-600' : 'text-slate-600'}`} />
                    ) : (
                      <Mail className={`w-4 h-4 ${overdue ? 'text-rose-600' : 'text-slate-600'}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium text-slate-900 ${skipped ? 'line-through text-slate-600' : ''}`}>
                      {touchPoint.order + 1}. {touchPoint.label}
                    </div>
                    <div className="text-xs text-slate-600">
                      {touchPoint.status === 'completed' && touchPoint.completedAt
                        ? `Completed ${new Date(touchPoint.completedAt).toLocaleDateString()}`
                        : skipped
                        ? `Skipped${touchPoint.skippedAt ? ' ' + new Date(touchPoint.skippedAt).toLocaleDateString() : ''}`
                        : touchPoint.dueDate
                        ? <>Due {new Date(touchPoint.dueDate).toLocaleDateString()}{overdue && <span className="text-rose-600 ml-1">• Overdue</span>}</>
                        : 'Pending'}
                    </div>
                  </div>

                  {!lead.stopped && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isCurrent && open && (
                        <button
                          onClick={() => onMarkComplete(touchPoint)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all ${
                            touchPoint.type === 'call' ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-violet-600 hover:bg-violet-700'
                          }`}
                        >
                          {touchPoint.type === 'call' ? 'Log Call' : 'Send Email'}
                        </button>
                      )}
                      {open && (
                        <button
                          onClick={() => onSkip(touchPoint)}
                          title="Skip this touch point"
                          aria-label="Skip this touch point"
                          className="w-8 h-8 rounded-lg text-slate-600 hover:bg-slate-100 flex items-center justify-center"
                        >
                          <SkipForward className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {skipped && (
                        <button
                          onClick={() => onRestore(touchPoint)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 flex items-center gap-1"
                        >
                          <Undo2 className="w-3 h-3" /> Restore
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Call logs */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Call History ({lead.detailLoaded ? lead.callLogs.length : lead.callCount ?? 0})</h3>
          {!lead.detailLoaded ? (
            <p className="text-sm text-slate-500" role="status">Loading…</p>
          ) : lead.callLogs.length === 0 ? (
            <p className="text-sm text-slate-500">No calls logged yet</p>
          ) : (
            <div className="space-y-2">
              {lead.callLogs.map(callLog => (
                <div key={callLog.id} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      callLog.type === 'discovery' ? 'bg-emerald-100 text-emerald-700' :
                      callLog.type === 'lvm' ? 'bg-amber-100 text-amber-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {callLog.type.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(callLog.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-slate-700">{callLog.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* History */}
        <div className="px-4 sm:px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Activity History</h3>
          {!lead.detailLoaded && <p className="text-sm text-slate-500" role="status">Loading…</p>}
          <div className="space-y-2">
            {lead.history.map(historyEntry => (
              <div key={historyEntry.id} className="flex items-start gap-2 text-xs">
                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full mt-1.5 shrink-0" />
                <div className="flex-1">
                  <span className="text-slate-600">
                    <span className="font-medium text-slate-900">{historyEntry.userName}</span> — {historyEntry.action.replace(/_/g, ' ')}
                    {historyEntry.detail && <span className="text-slate-500"> • {historyEntry.detail}</span>}
                  </span>
                  <div className="text-slate-500">{new Date(historyEntry.timestamp).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
