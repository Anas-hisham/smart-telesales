import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { PoolPreviewRow } from '@/features/leads/types/leadPool.types';
import { CLAIM_STATUS_TEXT } from '@/features/take-leads/constants/takeLeads.constants';

/** One line of the result list: the ID and what happened to it (the status comes from POST /lead-pool/preview). */
export function ClaimResultRow({ r: previewRow }: { r: PoolPreviewRow }) {
  const ok = previewRow.status === 'ready';
  const text = previewRow.status === 'taken' ? `Held by ${previewRow.holderName ?? 'another agent'}`
    : previewRow.status === 'recently_worked' ? `${CLAIM_STATUS_TEXT.recently_worked} - ${previewRow.daysLeft} day${previewRow.daysLeft === 1 ? '' : 's'} left before you can add it`
    : CLAIM_STATUS_TEXT[previewRow.status];
  return (
    <li className={`px-3 py-1.5 flex items-center gap-2 ${ok ? 'text-emerald-700' : 'text-rose-700'}`}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
      <span className="font-mono">{previewRow.code}</span>
      <span className="ml-auto text-right">{ok ? 'Added' : text}</span>
    </li>
  );
}
