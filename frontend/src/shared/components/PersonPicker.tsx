import { ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@/features/users/types/users.types';
import { UserAvatar } from '@/shared/components/UserAvatar';
import { roleLabel } from '@/shared/lib/roleLabel';

export interface PickerPerson {
  user: User;
  detail?: string;   // second line: team, Team Leader, manager ... (also searched)
  group?: string;    // header the person is listed under (people with the same group must be next to each other)
  badge?: string;    // small tag, e.g. "Suggested"
}

/** How many rows are drawn at once. With hundreds of people the list stays fast: the rest is reached by typing. */
const MAX_ROWS = 40;

/**
 * Searchable picker for people of ANY role. Type a name, username, role, team or manager and the list narrows;
 * role chips filter by position; ↑ ↓ Enter work too. Built to stay usable with many agents (only the first rows are drawn).
 */
export function PersonPicker({ people, value, onChange, placeholder = 'Search by name, role, team or manager...', roleChips = false, emptyText = 'Nobody matches' }: {
  people: PickerPerson[];
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  roleChips?: boolean;
  emptyText?: string;
}) {
  const selected = people.find(person => person.user.id === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const roles = useMemo(() => [...new Set(people.map(person => person.user.role))], [people]);
  const matches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return people.filter(person => {
      if (role && person.user.role !== role) return false;
      if (!normalizedQuery) return true;
      return `${person.user.name} ${person.user.username} ${roleLabel(person.user.role)} ${person.detail ?? ''}`.toLowerCase().includes(normalizedQuery);
    });
  }, [people, query, role]);
  const shown = matches.slice(0, MAX_ROWS);

  useEffect(() => {
    if (!open) return;
    const closeWhenClickingOutside = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', closeWhenClickingOutside);
    return () => document.removeEventListener('mousedown', closeWhenClickingOutside);
  }, [open]);
  useEffect(() => { setActive(0); }, [query, role]);
  useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const chooseOption = (id: string) => { onChange(id); setOpen(false); setQuery(''); };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive(previousActive => Math.min(previousActive + 1, shown.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(previousActive => Math.max(previousActive - 1, 0)); }
    else if (event.key === 'Enter' && open) { event.preventDefault(); const person = shown[active]; if (person) chooseOption(person.user.id); }
    else if (event.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      {selected && !open ? (
        <button type="button" onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white text-left hover:border-slate-300">
          <UserAvatar user={selected.user} size="w-7 h-7" />
          <span className="min-w-0">
            <span className="block truncate text-slate-900 font-medium">{selected.user.name} <span className="text-xs font-normal text-slate-500">· {roleLabel(selected.user.role)}</span></span>
            {selected.detail && <span className="block truncate text-xs text-slate-500">{selected.detail}</span>}
          </span>
          <span role="button" aria-label="Clear" onClick={event => { event.stopPropagation(); onChange(''); }}
            className="ml-auto w-5 h-5 rounded hover:bg-slate-100 flex items-center justify-center shrink-0"><X className="w-3.5 h-3.5 text-slate-500" /></span>
        </button>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" value={query} autoFocus={open} onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
            onChange={event => { setQuery(event.target.value); setOpen(true); }} placeholder={placeholder}
            className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white" />
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
          {roleChips && roles.length > 1 && (
            <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-slate-100">
              {['', ...roles].map(text => (
                <button key={text || 'all'} type="button" onMouseDown={event => event.preventDefault()} onClick={() => setRole(text)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${role === text ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {text ? roleLabel(text) : 'All'}
                </button>
              ))}
            </div>
          )}
          <div ref={listRef} className="max-h-60 overflow-y-auto scrollbar-thin py-1">
            {shown.length === 0 && <div className="px-4 py-3 text-sm text-slate-500">{emptyText}{query && <> for “{query}”</>}</div>}
            {shown.map((person, index) => (
              <div key={person.user.id}>
                {person.group && (index === 0 || shown[index - 1].group !== person.group) && <div className="px-4 pt-2 pb-1 text-[11px] font-semibold text-slate-500">{person.group}</div>}
                <button type="button" data-idx={index} onMouseEnter={() => setActive(index)} onClick={() => chooseOption(person.user.id)}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm ${index === active ? 'bg-blue-50' : ''} ${person.user.id === value ? 'font-semibold' : ''}`}>
                  <UserAvatar user={person.user} size="w-7 h-7" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-slate-900">{person.user.name} <span className="text-xs font-normal text-slate-500">· {roleLabel(person.user.role)}</span></span>
                    {person.detail && <span className="block truncate text-xs text-slate-500">{person.detail}</span>}
                  </span>
                  {person.badge && <span className="shrink-0 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">{person.badge}</span>}
                </button>
              </div>
            ))}
            {matches.length > MAX_ROWS && (
              <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-100">Showing {MAX_ROWS} of {matches.length} - type to narrow the list</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
