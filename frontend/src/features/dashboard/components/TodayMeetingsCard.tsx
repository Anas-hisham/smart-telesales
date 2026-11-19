import { Calendar } from 'lucide-react';
import type { Meeting } from '@/features/meetings/types/meetings.types';
import type { User } from '@/features/users/types/users.types';

export function TodayMeetingsCard({ meetings, users, title = "Today's Meetings" }: { meetings: Meeting[]; users: User[]; title?: string }) {
  const sorted = [...meetings].sort((meetingA, meetingB) => meetingA.time.localeCompare(meetingB.time));
  return (
    <div className="bg-violet-50/50 rounded-xl border border-violet-100 p-5">
      <h3 className="text-sm font-semibold text-violet-900 mb-3 flex items-center gap-1.5">
        <Calendar className="w-4 h-4" />
        {title} ({sorted.length})
      </h3>
      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500">No meetings today.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map(meeting => {
            const agent = users.find(user => user.id === meeting.agentId);
            const participants = meeting.type === 'lead_meeting'
              ? [meeting.companyName, agent?.name].filter(Boolean).join(' • ')
              : meeting.participantNames.join(', ');
            return (
              <div key={meeting.id} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-violet-100">
                <div className="w-14 text-center shrink-0">
                  <div className="text-sm font-bold text-violet-700">{meeting.time}</div>
                  <div className="text-[11px] text-slate-500">{meeting.duration}min</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{meeting.title}</div>
                  {participants && <div className="text-xs text-slate-600 truncate">{participants}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
