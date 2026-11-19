import { Download, Inbox } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { TouchPoint } from '@/features/campaigns/types/campaigns.types';
import {
  completeTouchPoint, logCallAndCompleteTouchPoint, removeLeadFromAgentQueue,
  restoreSkippedTouchPoint, resumeLeadWorkflow, skipTouchPoint, stopLeadWorkflow, takeLeadsFromPool,
} from '@/features/leads/thunks/leads.thunks';
import type { Lead } from '@/features/leads/types/leads.types';
import { queueCategory } from '@/features/leads/utils/callClassification';
import { queueBucket } from '@/features/leads/utils/leadQueue';
import { describeDueDate, findCurrentTouchPoint, stepLabel } from '@/features/leads/utils/touchPoints';
import { TakeLeadsModal } from '@/features/take-leads/components/TakeLeadsModal';
import { CallLogModal } from '@/features/work-queue/components/CallLogModal';
import { CampaignSection } from '@/features/work-queue/components/CampaignSection';
import { LeadDetailDrawer } from '@/features/work-queue/components/LeadDetailDrawer';
import { TodayMeetingsBanner } from '@/features/work-queue/components/TodayMeetingsBanner';
import { TouchPointEmailModal } from '@/features/work-queue/components/TouchPointEmailModal';
import { WorkQueueStats } from '@/features/work-queue/components/WorkQueueStats';
import { EMAIL_TEMPLATES } from '@/features/work-queue/constants/emailTemplates';
import { useCollapsibleSections } from '@/features/work-queue/hooks/useCollapsibleSections';
import { buildWorkQueue } from '@/features/work-queue/utils/buildWorkQueue';
import type { QueueHandlers } from '@/features/work-queue/utils/queueHandlers';
import { useConfirm } from '@/shared/components/ConfirmDialog';
import { LeadPicker } from '@/shared/components/LeadPicker';
import { localDay } from '@/shared/lib/dates';
import { useStore } from '@/store/hooks';

export function WorkQueuePage() {
  const { state, dispatch } = useStore();
  const currentUser = state.users.find(user => user.id === state.currentUserId)!;
  const sections = useCollapsibleSections();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [callLeadId, setCallLeadId] = useState<string | null>(null);
  const [emailLeadId, setEmailLeadId] = useState<string | null>(null);
  const [showTake, setShowTake] = useState(false);
  const { ask, dialog: confirmDialog } = useConfirm();
  const askSkip = (lead: Lead, touchPoint: TouchPoint) => ask(
    { title: 'Skip this touch point?', message: <>Step <b>{stepLabel(touchPoint.order, touchPoint.type)}</b> ({touchPoint.label}) for <b>{lead.companyName}</b> will be skipped and the lead moves to the next step. You can restore it later.</>, confirmLabel: 'Skip' },
    () => dispatch(skipTouchPoint({ leadId: lead.id, order: touchPoint.order })),
  );

  // agents never delete a lead: they remove it from their queue and it goes back to the pool (a recorded sale does not block this)
  const askRemove = (lead: Lead) => ask(
    { title: 'Remove from queue?', message: <><b>{lead.companyName}</b> leaves your work queue and will not continue its steps. Its history is kept and any sale you recorded stays yours. It goes back to the pool: you can take it again right away, other agents can take it after 15 days.</>, confirmLabel: 'Remove', tone: 'danger' },
    () => { dispatch(removeLeadFromAgentQueue(lead.id)); setSelectedLeadId(null); },
  );

  // live clock: a lead moves from Next to Today by itself when its day arrives
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(intervalId);
  }, []);

  // always read the live lead from the store (so modals/drawers never act on a stale copy)
  const leadById = (id: string | null) => (id ? state.leads.find(lead => lead.id === id) : undefined);
  const selectedLead = leadById(selectedLeadId);
  const callLead = leadById(callLeadId);
  const emailLead = leadById(emailLeadId);

  const myLeads = useMemo(
    () => state.leads.filter(lead => !lead.removedFromQueue && !lead.expiredAt && lead.agentId === currentUser.id),
    [state.leads, currentUser.id],
  );
  const queue = useMemo(() => buildWorkQueue(myLeads, state.workflows, now), [myLeads, state.workflows, now]);

  const todayStr = localDay();
  const arrangedMeetingsToday = useMemo(() => state.meetings.filter(meeting =>
    meeting.type === 'lead_meeting' && meeting.date === todayStr && meeting.status === 'arranged' &&
    meeting.participantIds.includes(currentUser.id)
  ), [state.meetings, currentUser.id, todayStr]);

  const currentTP = findCurrentTouchPoint;

  const handleMarkComplete = (lead: Lead, touchPoint: TouchPoint) => {
    if (touchPoint.type === 'call') setCallLeadId(lead.id);
    else setEmailLeadId(lead.id);
  };

  const todayTotal = queue.reduce((count, campaignQueue) => count + campaignQueue.todayCount, 0);
  const nextTotal = queue.reduce((count, campaignQueue) => count + campaignQueue.nextCount, 0);
  const stoppedTotal = queue.reduce((count, campaignQueue) => count + campaignQueue.stopped.length, 0);
  const overdueCount = myLeads.filter(myLead => queueBucket(myLead, now) === 'today' && describeDueDate(currentTP(myLead)).tone === 'overdue').length;

  const handlers: QueueHandlers = {
    onMarkComplete: handleMarkComplete,
    onSkip: askSkip,
    onDetails: lead => setSelectedLeadId(lead.id),
    onResume: leadId => dispatch(resumeLeadWorkflow(leadId)),
    onRequestRemove: askRemove,
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <WorkQueueStats
        todayTotal={todayTotal} overdueCount={overdueCount} nextTotal={nextTotal}
        stoppedTotal={stoppedTotal} meetingsTodayCount={arrangedMeetingsToday.length}
      />

      <TodayMeetingsBanner
        meetings={arrangedMeetingsToday}
        onOpenMeeting={meeting => { if (meeting.leadId && leadById(meeting.leadId)) setSelectedLeadId(meeting.leadId); }}
      />

      {/* Find a lead: type to search, then select it to open its details (same picker as the email form) */}
      <div className="mb-6 flex gap-3">
        <div className="flex-1 min-w-0">
          <LeadPicker
            leads={myLeads}
            value=""
            onChange={id => { if (id) setSelectedLeadId(id); }}
            placeholder="Search a lead by name, code, email or phone, then select it..."
          />
        </div>
        <button
          onClick={() => setShowTake(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all flex items-center gap-1.5 shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Take Leads
        </button>
      </div>

      {showTake && (
        <TakeLeadsModal
          onTake={ids => dispatch(takeLeadsFromPool(ids))}
          onClose={() => setShowTake(false)}
        />
      )}

      {/* Work queue: campaign -> Today / Next / Stop */}
      <div className="space-y-3">
        {queue.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No leads in your work queue</p>
            <p className="text-xs mt-1">Use “Take Leads” to get leads from the pool.</p>
          </div>
        )}

        {queue.map(campaign => (
          <CampaignSection key={campaign.code} campaign={campaign} now={now} sections={sections} handlers={handlers} />
        ))}
      </div>

      {/* Lead detail drawer */}
      {selectedLead && (
        <LeadDetailDrawer
          lead={selectedLead}
          onClose={() => setSelectedLeadId(null)}
          onMarkComplete={touchPoint => handleMarkComplete(selectedLead, touchPoint)}
          onSkip={touchPoint => askSkip(selectedLead, touchPoint)}
          onRestore={touchPoint => dispatch(restoreSkippedTouchPoint({ leadId: selectedLead.id, order: touchPoint.order }))}
          onStop={() => ask(
            { title: 'Stop this workflow?', message: <><b>{selectedLead.companyName}</b> leaves Today / Next and moves to Stop. You can resume it later.</>, confirmLabel: 'Stop workflow' },
            () => dispatch(stopLeadWorkflow(selectedLead.id)),
          )}
          onResume={() => dispatch(resumeLeadWorkflow(selectedLead.id))}
          onRemove={() => askRemove(selectedLead)}
          agentName={state.users.find(user => user.id === selectedLead.agentId)?.name || ''}
        />
      )}

      {/* Call log modal */}
      {callLead && (
        <CallLogModal
          lead={callLead}
          onClose={() => setCallLeadId(null)}
          onSave={(type, description, reason) => {
            const order = callLead.currentTouchPoint;
            // one atomic action: the call log and the completed step can never get out of sync
            dispatch(logCallAndCompleteTouchPoint({ leadId: callLead.id, log: { type, description, touchPointOrder: order, reason } }));
            setCallLeadId(null);
          }}
        />
      )}

      {/* Email modal */}
      {emailLead && (
        <TouchPointEmailModal
          lead={emailLead}
          category={queueCategory(emailLead)}
          templates={EMAIL_TEMPLATES}
          onClose={() => setEmailLeadId(null)}
          onDone={() => {
            dispatch(completeTouchPoint({ leadId: emailLead.id, order: emailLead.currentTouchPoint }));
            setEmailLeadId(null);
          }}
        />
      )}

      {confirmDialog}
    </div>
  );
}
