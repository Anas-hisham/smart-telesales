import { AlertTriangle, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { API_ERROR_EVENT, API_NOTICE_EVENT } from '@/shared/api/apiErrors';

/** Shows why the server refused an action (or that it cannot be reached). Closes itself after a few seconds. */
export function ApiErrorBanner() {
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<'error' | 'info'>('error');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const showMessage = (kind: 'error' | 'info') => (event: Event) => {
      setTone(kind);
      setMessage((event as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(''), 8000);
    };
    const onError = showMessage('error');
    const onNotice = showMessage('info');
    window.addEventListener(API_ERROR_EVENT, onError);
    window.addEventListener(API_NOTICE_EVENT, onNotice);
    return () => { window.removeEventListener(API_ERROR_EVENT, onError); window.removeEventListener(API_NOTICE_EVENT, onNotice); clearTimeout(timer); };
  }, []);

  if (!message) return null;
  return (
    <div role="alert" className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[min(92vw,34rem)] text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 ${tone === 'info' ? 'bg-slate-800' : 'bg-rose-600'}`}>
      {tone === 'info' ? <Info className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
      <p className="text-sm flex-1">{message}</p>
      <button onClick={() => setMessage('')} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20" aria-label="Close">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
