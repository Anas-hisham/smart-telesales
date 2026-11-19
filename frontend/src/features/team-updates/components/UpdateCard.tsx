import { Check, CheckCircle2, Clock, UserCheck } from 'lucide-react';
import type { TeamUpdate } from '@/features/team-updates/types/teamUpdates.types';
import type { User } from '@/features/users/types/users.types';
import { Collapsible } from '@/shared/components/Collapsible';

/** One announcement: who wrote it, the text, who acknowledged it (for the author / the OM), and the Acknowledge button (for recipients). */
export function UpdateCard({ update, me: currentUser, author, audienceLabel, recipients, onAcknowledge }: {
  update: TeamUpdate; me: User; author?: User; audienceLabel: string; recipients: User[]; onAcknowledge: () => void;
}) {
  const acknowledged = update.acknowledgedBy.includes(currentUser.id);
  const canAck = recipients.some(recipientUser => recipientUser.id === currentUser.id);
  const ackRecipients = recipients.filter(recipientUser => update.acknowledgedBy.includes(recipientUser.id));
  const pendingRecipients = recipients.filter(recipientUser => !update.acknowledgedBy.includes(recipientUser.id));
  const showAckList = update.authorId === currentUser.id || currentUser.role === 'operation_manager';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0" style={{ backgroundColor: author?.color || '#64748b' }}>
            {author?.initials || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-slate-900">{update.authorName}{update.authorId === currentUser.id && <span className="ml-1.5 text-xs font-normal text-blue-600">(you)</span>}</span>
              <span className="text-xs text-slate-500">
                {new Date(update.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <h3 className="font-semibold text-slate-900 mt-0.5">{update.title}</h3>
            <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">To: {audienceLabel}</span>
          </div>
          {!acknowledged && canAck && <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse-ring shrink-0 mt-2" />}
        </div>

        <p className="text-sm text-slate-600 leading-relaxed mb-4">{update.content}</p>

        {showAckList && recipients.length > 0 && (
          <Collapsible
            defaultOpen={false}
            className="border-t border-slate-100 pt-3"
            header={
              <span className="flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-medium text-slate-600">Acknowledgments</span>
                <span className="text-xs text-slate-500">{ackRecipients.length}/{recipients.length}</span>
              </span>
            }
          >
            <div className="flex flex-wrap gap-1.5 mt-2 pl-6">
              {ackRecipients.map(recipientUser => (
                <div key={recipientUser.id} className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-lg">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span className="text-xs text-emerald-700 font-medium">{recipientUser.name}</span>
                </div>
              ))}
              {pendingRecipients.map(recipientUser => (
                <div key={recipientUser.id} className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span className="text-xs text-slate-600">{recipientUser.name}</span>
                </div>
              ))}
            </div>
          </Collapsible>
        )}

        {canAck && (
          <button
            onClick={onAcknowledge}
            disabled={acknowledged}
            className={`mt-3 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${acknowledged ? 'bg-emerald-100 text-emerald-700 cursor-default' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
          >
            <Check className="w-3.5 h-3.5" />
            {acknowledged ? 'Acknowledged' : 'Acknowledge'}
          </button>
        )}
      </div>
    </div>
  );
}
