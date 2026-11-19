import { Bell, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CreateUpdateModal } from '@/features/team-updates/components/CreateUpdateModal';
import { UpdateCard } from '@/features/team-updates/components/UpdateCard';
import { acknowledgeTeamUpdate, markUpdatesSeen, postTeamUpdate } from '@/features/team-updates/thunks/teamUpdates.thunks';
import type { TeamUpdate } from '@/features/team-updates/types/teamUpdates.types';
import { updateRecipients } from '@/features/team-updates/utils/updateRecipients';
import { DoneSection } from '@/shared/components/DoneSection';
import { Pagination } from '@/shared/components/Pagination';
import { usePagination } from '@/shared/hooks/usePagination';
import { useStore } from '@/store/hooks';

const UPDATES_PER_PAGE = 5;

export function TeamUpdatesPage() {
  const { state, dispatch } = useStore();
  const currentUser = state.users.find(user => user.id === state.currentUserId)!;
  const [showCreate, setShowCreate] = useState(false);
  const canCreate = currentUser.role === 'team_leader' || currentUser.role === 'operation_manager';

  // Opening this page is what clears the number in the menu (the bell notifications stay until "Mark read")
  const hasUnseen = state.updates.some(update => !update.seenBy.includes(currentUser.id));
  useEffect(() => { if (hasUnseen) dispatch(markUpdatesSeen(currentUser.id)); }, [hasUnseen, currentUser.id, dispatch]);

  const recipientsOfUpdate = (teamUpdate: TeamUpdate) => updateRecipients(teamUpdate, state.users, state.teams);
  const visible = state.updates;   // the server sends only the updates this person wrote or received

  // "Handled": a recipient pressed Acknowledge; for the author / the OM it means everybody acknowledged.
  const isHandled = (teamUpdate: TeamUpdate) => {
    const recipients = recipientsOfUpdate(teamUpdate);
    if (recipients.some(recipient => recipient.id === currentUser.id)) return teamUpdate.acknowledgedBy.includes(currentUser.id);
    return recipients.every(recipient => teamUpdate.acknowledgedBy.includes(recipient.id));
  };
  const open = usePagination(visible.filter(teamUpdate => !isHandled(teamUpdate)), UPDATES_PER_PAGE);
  const handled = usePagination(visible.filter(isHandled), UPDATES_PER_PAGE);

  const audienceLabel = (teamUpdate: TeamUpdate) =>
    teamUpdate.audience === 'all' ? 'Everyone' : teamUpdate.audience === 'team_leaders' ? 'All Team Leaders' : teamUpdate.audience === 'quality' ? 'Quality'
      : state.teams.find(team => team.id === teamUpdate.teamId)?.name || 'Team';

  const renderUpdate = (teamUpdate: TeamUpdate) => (
    <UpdateCard
      key={teamUpdate.id} update={teamUpdate} me={currentUser} author={state.users.find(user => user.id === teamUpdate.authorId)}
      audienceLabel={audienceLabel(teamUpdate)} recipients={recipientsOfUpdate(teamUpdate)}
      onAcknowledge={() => dispatch(acknowledgeTeamUpdate(teamUpdate.id))}
    />
  );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Team Updates</h2>
          <p className="text-sm text-slate-600">
            {currentUser.role === 'operation_manager' ? 'Send updates to team leaders, Quality or everyone'
              : currentUser.role === 'team_leader' ? 'Updates from management, and updates for your team agents'
              : currentUser.role === 'quality' ? 'Updates from management'
              : 'Updates from your team leader and management'}
          </p>
        </div>
        {canCreate && (
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" />New Update
          </button>
        )}
      </div>

      {visible.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No updates yet</p>
        </div>
      )}

      {visible.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">
            Needs attention <span className="ml-1 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{open.total}</span>
          </h3>
          {open.total === 0 ? (
            <p className="text-sm text-slate-500 bg-white rounded-xl border border-dashed border-slate-200 px-5 py-6 text-center">You are all caught up. 🎉</p>
          ) : (
            <div className="space-y-4">{open.pageItems.map(renderUpdate)}</div>
          )}
          <Pagination {...open} onPage={open.setPage} />
        </section>
      )}

      {/* Already acknowledged: closed until the person opens it, so the old ones never pile up under the new ones */}
      <DoneSection title="Acknowledged" count={handled.total}>
        <div className="space-y-4">{handled.pageItems.map(renderUpdate)}</div>
        <Pagination {...handled} onPage={handled.setPage} />
      </DoneSection>

      {showCreate && (
        <CreateUpdateModal
          currentUser={currentUser} state={state}
          onClose={() => setShowCreate(false)}
          onCreate={update => { dispatch(postTeamUpdate(update)); setShowCreate(false); }}
        />
      )}
    </div>
  );
}
