import { Lightbulb, X } from 'lucide-react';
import { useState } from 'react';
import type { Team } from '@/features/teams/types/teams.types';
import type { User } from '@/features/users/types/users.types';
import { Collapsible } from '@/shared/components/Collapsible';

/** Quality writes one piece of advice and picks the agents it is for (team by team, the arrow opens a team). */
export function SendTipModal({ teams, users, onClose, onSend }: {
  teams: Team[]; users: User[]; onClose: () => void;
  onSend: (agentIds: string[], title: string, content: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const agentsOfTeam = (team: Team) => team.agentIds.map(id => users.find(user => user.id === id)).filter((user): user is User => !!user);
  const toggle = (id: string) => setSelected(previousSelected => previousSelected.includes(id) ? previousSelected.filter(value => value !== id) : [...previousSelected, id]);
  const toggleTeam = (team: Team) => {
    const ids = team.agentIds;
    const allSelected = ids.every(id => selected.includes(id));
    setSelected(previousSelected => allSelected ? previousSelected.filter(id => !ids.includes(id)) : [...new Set([...previousSelected, ...ids])]);
  };
  const input = 'w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-slide-up max-h-[92vh] max-h-[92dvh] flex flex-col">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Lightbulb className="w-5 h-5 text-amber-500" />New Tip</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-600" /></button>
        </div>
        <div className="px-4 sm:px-6 py-5 space-y-4 overflow-y-auto scrollbar-thin">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
            <input type="text" value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Open the call with the customer's name" className={input} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Advice</label>
            <textarea value={content} onChange={event => setContent(event.target.value)} rows={4} placeholder="What should the agent do differently?" className={`${input} resize-none`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Send to <span className="text-xs font-normal text-slate-500">({selected.length} selected)</span></label>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto scrollbar-thin">
              {teams.map(team => {
                const agents = agentsOfTeam(team);
                const allSelected = agents.length > 0 && agents.every(agent => selected.includes(agent.id));
                return (
                  <Collapsible
                    key={team.id} defaultOpen={false} headerClassName="px-3 py-2 hover:bg-slate-50"
                    header={
                      <span className="flex items-center gap-2">
                        <input type="checkbox" checked={allSelected} onClick={event => event.stopPropagation()} onChange={() => toggleTeam(team)} className="rounded" aria-label={`Select all of ${team.name}`} />
                        <span className="text-sm font-medium text-slate-800">{team.name}</span>
                        <span className="ml-auto text-xs text-slate-500">{agents.filter(agent => selected.includes(agent.id)).length}/{agents.length}</span>
                      </span>
                    }
                  >
                    <div className="pb-2 pl-9 pr-3 space-y-0.5">
                      {agents.map(agent => (
                        <label key={agent.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer">
                          <input type="checkbox" checked={selected.includes(agent.id)} onChange={() => toggle(agent.id)} className="rounded" />
                          <span className="text-sm text-slate-700">{agent.name}</span>
                        </label>
                      ))}
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </div>
        </div>
        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
          <button
            onClick={() => onSend(selected, title, content)}
            disabled={!title.trim() || !content.trim() || selected.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-all"
          >
            Send Tip
          </button>
        </div>
      </div>
    </div>
  );
}
