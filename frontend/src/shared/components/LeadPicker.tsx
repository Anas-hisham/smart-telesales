import { ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lead } from '@/features/leads/types/leads.types';

/** What the picker needs of a lead (the meeting form only gets the short version from the server). */
export type PickableLead = Pick<Lead, 'id' | 'companyName' | 'contactName'> & Partial<Pick<Lead, 'leadCode' | 'email' | 'phone'>>;

const MAX_RESULTS = 50;

/**
 * Searchable lead selector (replaces a plain <select> so it stays usable with hundreds of leads).
 * Type company / contact name, lead code, email or phone, then pick with the mouse or ↑ ↓ Enter.
 */
export function LeadPicker({
  leads, value, onChange, placeholder = 'Search by lead name, code or email...',
}: {
  leads: PickableLead[];
  value: string;
  onChange: (leadId: string) => void;
  placeholder?: string;
}) {
  const selected = leads.find(lead => lead.id === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchingLeads = normalizedQuery
      ? leads.filter(lead =>
          lead.companyName.toLowerCase().includes(normalizedQuery) ||
          lead.contactName.toLowerCase().includes(normalizedQuery) ||
          (lead.leadCode ?? '').toLowerCase().includes(normalizedQuery) ||
          (lead.email || '').toLowerCase().includes(normalizedQuery) ||
          (lead.phone || '').replace(/\s/g, '').includes(normalizedQuery.replace(/\s/g, '')))
      : leads;
    return { shown: matchingLeads.slice(0, MAX_RESULTS), total: matchingLeads.length };
  }, [leads, query]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const closeWhenClickingOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeWhenClickingOutside);
    return () => document.removeEventListener('mousedown', closeWhenClickingOutside);
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);

  // keep the highlighted row visible while using the keyboard
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const chooseOption = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive(previousActive => Math.min(previousActive + 1, matches.shown.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(previousActive => Math.max(previousActive - 1, 0)); }
    else if (event.key === 'Enter' && open) { event.preventDefault(); const pickableLead = matches.shown[active]; if (pickableLead) chooseOption(pickableLead.id); }
    else if (event.key === 'Escape') { setOpen(false); }
  };

  const inputClass = 'w-full pl-9 pr-9 py-2.5 rounded-lg border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white';

  return (
    <div ref={rootRef} className="relative">
      {selected && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white text-left hover:border-slate-300"
        >
          {selected.leadCode && <span className="font-mono text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">{selected.leadCode}</span>}
          <span className="truncate text-slate-900">{selected.companyName}</span>
          <span className="truncate text-slate-500 text-xs">{selected.contactName}</span>
          <span
            role="button"
            aria-label="Clear linked lead"
            onClick={event => { event.stopPropagation(); onChange(''); }}
            className="ml-auto w-5 h-5 rounded hover:bg-slate-100 flex items-center justify-center shrink-0"
          >
            <X className="w-3.5 h-3.5 text-slate-500" />
          </span>
        </button>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={query}
            autoFocus={open}
            onFocus={() => setOpen(true)}
            onChange={event => { setQuery(event.target.value); setOpen(true); }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className={inputClass}
          />
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
          <div ref={listRef} className="max-h-60 overflow-y-auto scrollbar-thin py-1">
            {matches.shown.length === 0 && (
              <div className="px-4 py-3 text-sm text-slate-500">No leads match “{query}”</div>
            )}
            {matches.shown.map((pickableLead, index) => (
              <button
                type="button"
                key={pickableLead.id}
                data-idx={index}
                onMouseEnter={() => setActive(index)}
                onClick={() => chooseOption(pickableLead.id)}
                className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm ${index === active ? 'bg-blue-50' : ''} ${pickableLead.id === value ? 'font-semibold' : ''}`}
              >
                {pickableLead.leadCode && <span className="font-mono text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">{pickableLead.leadCode}</span>}
                <span className="truncate text-slate-900">{pickableLead.companyName}</span>
                <span className="truncate text-slate-500 text-xs ml-auto">{pickableLead.contactName}</span>
              </button>
            ))}
          </div>
          {matches.total > MAX_RESULTS && (
            <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-100 bg-slate-50">
              Showing {MAX_RESULTS} of {matches.total} — keep typing to narrow it down
            </div>
          )}
        </div>
      )}
    </div>
  );
}
