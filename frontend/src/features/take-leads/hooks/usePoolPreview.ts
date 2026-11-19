import { useEffect, useState } from 'react';
import { leadPoolApi } from '@/features/leads/api/leadPool.api';
import type { PoolPreviewRow } from '@/features/leads/types/leadPool.types';
import { errorText } from '@/shared/api/client';

/**
 * Asks the server what would happen to each typed lead id (POST /lead-pool/preview).
 * Waits a moment after typing and ignores answers that arrive late.
 */
export function usePoolPreview(text: string) {
  const [rows, setRows] = useState<PoolPreviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!text.trim()) { setRows([]); setBusy(false); setError(''); return; }
    let stale = false;
    setBusy(true);
    const timeoutId = setTimeout(async () => {
      try {
        const preview = await leadPoolApi.preview(text);
        if (!stale) { setRows(preview.results); setError(''); }
      } catch (caughtError) {
        if (!stale) { setRows([]); setError(errorText(caughtError)); }
      } finally {
        if (!stale) setBusy(false);
      }
    }, 350);
    return () => { stale = true; clearTimeout(timeoutId); };
  }, [text]);

  return { rows, busy, error };
}
