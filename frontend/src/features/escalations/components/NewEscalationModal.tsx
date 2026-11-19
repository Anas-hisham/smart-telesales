import { useEffect, useMemo, useState } from 'react';
import { escalationsApi } from '@/features/escalations/api/escalations.api';
import { reportingLine } from '@/features/escalations/utils/escalationRules';
import { LeadImportModalShell } from '@/features/lead-pool/components/LeadImportModalShell';
import type { Team } from '@/features/teams/types/teams.types';
import type { User } from '@/features/users/types/users.types';
import { reportError } from '@/shared/api/apiErrors';
import { PersonPicker, type PickerPerson } from '@/shared/components/PersonPicker';
import { TEXT_INPUT_CLASS } from '@/shared/constants/formStyles';
import { roleLabel } from '@/shared/lib/roleLabel';

const ROLE_ORDER = ['agent', 'quality', 'team_leader', 'operation_manager', 'admin'];

/**
 * Raise an escalation about ANYBODY in the account (any team, any role). Both pickers are searchable and show where each person sits
 * (team, Team Leader, Operation Manager, Quality); who can receive it depends on position, see escalationRules.
 */
export function NewEscalationModal({ subjects: subjectUsers, users, teams, onSend, onClose }: {
  /** The people this person may raise a problem about (GET /escalations/subjects) */
  subjects: User[]; users: User[]; teams: Team[];
  onSend: (newEscalation: { aboutId: string; recipientId: string; title: string; details: string }) => void;
  onClose: () => void;
}) {
  const [aboutId, setAboutId] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');

  /** "Team Alpha · TL Sara Ali · OM Ahmed · Quality Mona" - who this person belongs to. */
  const describePerson = (person: User): string => {
    const reportingChain = reportingLine(users, teams, person);
    const parts: string[] = [];
    if (reportingChain.team) parts.push(person.role === 'team_leader' ? `Leads ${reportingChain.team.name}` : reportingChain.team.name);
    if (reportingChain.teamLeader) parts.push(`TL ${reportingChain.teamLeader.name}`);
    if (reportingChain.manager && person.role !== 'operation_manager') parts.push(`OM ${reportingChain.manager.name}`);
    if (reportingChain.quality) parts.push(`Quality ${reportingChain.quality.name}`);
    if (person.lob) parts.push(`LOB ${person.lob}`);
    return parts.join(' · ');
  };

  const subjects = useMemo<PickerPerson[]>(() =>
    [...subjectUsers]
      .sort((subjectUserA, subjectUserB) => ROLE_ORDER.indexOf(subjectUserA.role) - ROLE_ORDER.indexOf(subjectUserB.role) || subjectUserA.name.localeCompare(subjectUserB.name))
      .map(user => ({ user, detail: describePerson(user), group: `${roleLabel(user.role)}s` })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subjectUsers, users, teams]);

  const subject = users.find(candidateUser => candidateUser.id === aboutId) ?? subjectUsers.find(subjectUser => subjectUser.id === aboutId);
  // who can receive it depends on the person it is about: the server decides (GET /escalations/recipients)
  const [recipients, setRecipients] = useState<{ user: User; reason: string }[]>([]);
  useEffect(() => {
    if (!aboutId) { setRecipients([]); return; }
    let stale = false;
    escalationsApi.recipients(aboutId).then(recipient => { if (!stale) setRecipients(recipient); }).catch(error => { if (!stale) { setRecipients([]); reportError(error); } });
    return () => { stale = true; };
  }, [aboutId]);
  const recipientPeople = useMemo<PickerPerson[]>(() =>
    recipients.map(recipient => ({ user: recipient.user, detail: describePerson(recipient.user), group: recipient.reason ? 'Suggested' : 'Other people who can receive it', badge: recipient.reason || undefined })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recipients, users, teams]);
  const toId = recipients.some(recipient => recipient.user.id === recipientId) ? recipientId : recipients[0]?.user.id ?? '';
  const line = subject ? reportingLine(users, teams, subject) : null;
  const canSend = !!subject && !!toId && !!title.trim() && !!details.trim();
  const label = 'block text-sm font-medium text-slate-700 mb-1.5';

  return (
    <LeadImportModalShell title="New Escalation" subtitle="Send a problem to the right person" onClose={onClose}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
        <button onClick={() => canSend && onSend({ aboutId, recipientId: toId, title, details })} disabled={!canSend}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40">Escalate</button>
      </>}>
      {subjects.length === 0 ? (
        <p className="text-sm text-slate-600">There is nobody you can escalate right now.</p>
      ) : (
        <>
          <div>
            <label className={label}>Who is it about?</label>
            <PersonPicker people={subjects} value={aboutId} onChange={id => { setAboutId(id); setRecipientId(''); }} roleChips
              placeholder="Search any agent, Team Leader, Quality or manager..." />
            {line && subject && (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs bg-slate-50 rounded-lg px-3 py-2">
                {line.team && <><dt className="text-slate-500">Team</dt><dd className="text-slate-800">{line.team.name}</dd></>}
                {line.teamLeader && <><dt className="text-slate-500">Team Leader</dt><dd className="text-slate-800">{line.teamLeader.name}</dd></>}
                {line.manager && <><dt className="text-slate-500">Operation Manager</dt><dd className="text-slate-800">{line.manager.name}</dd></>}
                {line.quality && <><dt className="text-slate-500">Quality</dt><dd className="text-slate-800">{line.quality.name}</dd></>}
                {subject.lob && <><dt className="text-slate-500">LOB</dt><dd className="text-slate-800">{subject.lob}</dd></>}
                {!line.team && !line.manager && !line.quality && !subject.lob && <dd className="col-span-2 text-slate-500">{roleLabel(subject.role)}</dd>}
              </dl>
            )}
          </div>

          {subject && (
            <div>
              <label className={label}>Send it to</label>
              <PersonPicker people={recipientPeople} value={toId} onChange={setRecipientId} roleChips placeholder="Search who should receive it..." />
              <p className="text-xs text-slate-500 mt-1">Only a Team Leader, Operation Manager or Admin above both of you can receive it. Suggested people are the closest to the case.</p>
            </div>
          )}

          <div><label className={label}>Title</label><input className={TEXT_INPUT_CLASS} value={title} onChange={event => setTitle(event.target.value)} placeholder="What is the problem in a few words?" /></div>
          <div><label className={label}>Details</label><textarea className={`${TEXT_INPUT_CLASS} resize-none`} rows={4} value={details} onChange={event => setDetails(event.target.value)} placeholder="What happened, when, and what you need." /></div>
        </>
      )}
    </LeadImportModalShell>
  );
}
