import { Users as UsersIcon, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { meetingsApi } from '@/features/meetings/api/meetings.api';
import type { Meeting, MeetingInput, MeetingOptions } from '@/features/meetings/types/meetings.types';
import type { User } from '@/features/users/types/users.types';
import { reportError } from '@/shared/api/apiErrors';
import { LeadPicker } from '@/shared/components/LeadPicker';
import { localDay } from '@/shared/lib/dates';
import type { AppState } from '@/store/types';

/** Starting point of the form: copy the lead / people / title / length / agenda of an existing meeting. */
export interface MeetingPrefill {
  source: Meeting;
  purpose: 'reschedule' | 'follow_up';
}

export function CreateMeetingModal({
  state, currentUser, onClose, onCreate, prefill,
}: {
  state: AppState;
  currentUser: User;
  onClose: () => void;
  onCreate: (meeting: MeetingInput) => void;
  prefill?: MeetingPrefill;
}) {
  const isAgent = currentUser.role === 'agent';
  const isTeamLeader = currentUser.role === 'team_leader';
  const isOperationManager = currentUser.role === 'operation_manager';
  const isQuality = currentUser.role === 'quality';   // Quality schedules meetings with agents exactly like a team leader does

  const from = prefill?.source;
  const [leadId, setLeadId] = useState(from?.leadId ?? '');
  const [participantIds, setParticipantIds] = useState<string[]>(isAgent ? [] : from?.participantIds ?? []);
  const [title, setTitle] = useState(from?.title ?? '');
  const [date, setDate] = useState(localDay());
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState(from?.duration ?? 30);
  const [notes, setNotes] = useState(from?.notes ?? '');

  // who this person may invite and which leads a meeting can be about: the server decides (GET /meetings/options)
  const [options, setOptions] = useState<MeetingOptions>({ leads: [], participants: [] });
  useEffect(() => {
    let stale = false;
    meetingsApi.options().then(meetingOptions => { if (!stale) setOptions(meetingOptions); }).catch(reportError);
    return () => { stale = true; };
  }, []);
  const availableLeads = options.leads;
  const availableParticipants: User[] = isAgent ? [] : options.participants;
  const teamNameOf = (userId: string) => state.teams.find(team => team.agentIds.includes(userId) || team.leaderId === userId)?.name;

  const handleCreate = () => {
    if (isAgent && leadId) {
      onCreate({ leadId, date, time, duration, notes: notes.trim() || undefined });
    } else if ((isTeamLeader || isOperationManager || isQuality) && participantIds.length > 0) {
      onCreate({ leadId: leadId || undefined, participantIds, title: title.trim() || undefined, date, time, duration, notes: notes.trim() || undefined });
    }
  };

  const allSelected = availableParticipants.length > 0 && availableParticipants.every(availableParticipant => participantIds.includes(availableParticipant.id));
  const toggleAll = () => setParticipantIds(allSelected ? [] : availableParticipants.map(availableParticipant => availableParticipant.id));

  const canCreate = isAgent ? !!leadId : participantIds.length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-slide-up max-h-[92vh] max-h-[92dvh] overflow-y-auto scrollbar-thin">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-slate-900">{prefill?.purpose === 'reschedule' ? 'Reschedule Meeting' : prefill ? 'Schedule Another Meeting' : 'Schedule Meeting'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-5 space-y-4">
          {isAgent && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Lead</label>
              <LeadPicker leads={availableLeads} value={leadId} onChange={setLeadId} placeholder="Search a lead, then select it..." />
            </div>
          )}

          {(isTeamLeader || isOperationManager || isQuality) && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Title (optional)</label>
                <input
                  type="text"
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  placeholder="Meeting title..."
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">
                    <UsersIcon className="w-3.5 h-3.5 inline mr-1" />
                    {isOperationManager ? 'Select Team Leaders / Quality' : 'Select Agents'}
                    <span className="text-xs text-slate-500 font-normal ml-1">({participantIds.length}/{availableParticipants.length})</span>
                  </label>
                  {availableParticipants.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      {allSelected ? 'Clear all' : isOperationManager ? 'Select all' : 'Select all agents'}
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto scrollbar-thin border border-slate-200 rounded-xl p-2">
                  {availableParticipants.map(availableParticipant => (
                    <label key={availableParticipant.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={participantIds.includes(availableParticipant.id)}
                        onChange={event => {
                          if (event.target.checked) setParticipantIds([...participantIds, availableParticipant.id]);
                          else setParticipantIds(participantIds.filter(id => id !== availableParticipant.id));
                        }}
                        className="rounded"
                      />
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0" style={{ backgroundColor: availableParticipant.color }}>
                        {availableParticipant.initials}
                      </div>
                      <span className="text-sm text-slate-700">{availableParticipant.name}</span>
                      {(isQuality || isOperationManager) && <span className="ml-auto text-[11px] text-slate-500">{availableParticipant.role === 'quality' ? 'Quality' : teamNameOf(availableParticipant.id)}</span>}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={event => setDate(event.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Time</label>
              <input
                type="time"
                value={time}
                onChange={event => setTime(event.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Duration (minutes)</label>
            <div className="flex gap-2">
              {[15, 30, 45, 60].map(denominator => (
                <button
                  key={denominator}
                  onClick={() => setDuration(denominator)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    duration === denominator ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {denominator}min
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={event => setNotes(event.target.value)}
              placeholder="Meeting agenda or notes..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-all"
          >
            Schedule Meeting
          </button>
        </div>
      </div>
    </div>
  );
}
