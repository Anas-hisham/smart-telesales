import { useEffect } from 'react';
import { refreshTick } from '@/features/workspace/thunks/workspace.thunks';
import { useAppDispatch } from '@/store/hooks';

/** How often the screen asks the server what is new (notifications, meetings, the agent's leads). The server runs the 15-day expiry and meeting reminders itself. */
const SYNC_INTERVAL_MS = 30_000;

export function useSyncTick(enabled: boolean) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!enabled) return;
    const refreshIfVisible = () => { if (document.visibilityState === 'visible') void dispatch(refreshTick()); };
    const intervalId = setInterval(refreshIfVisible, SYNC_INTERVAL_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);   // catch up when the tab comes back
    return () => { clearInterval(intervalId); document.removeEventListener('visibilitychange', refreshIfVisible); };
  }, [enabled, dispatch]);
}
