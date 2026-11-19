import { Calendar, Phone, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';
import { login } from '@/features/auth/thunks/auth.thunks';
import { errorText } from '@/shared/api/client';
import { useAppDispatch } from '@/store/hooks';

export function LoginPage() {
  const dispatch = useAppDispatch();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password || busy) return;
    setBusy(true); setError('');
    try {
      await dispatch(login(username, password));       // success: the app switches to the signed-in screens by itself
    } catch (caughtError) {
      setError(errorText(caughtError));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[46%] bg-slate-950 relative overflow-hidden">
        <div className="absolute -top-32 -left-24 w-[26rem] h-[26rem] bg-blue-600/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-20 w-[28rem] h-[28rem] bg-cyan-500/15 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-14 text-white w-full">
          <div>
            <div className="flex items-center gap-3 mb-14">
              <div className="w-11 h-11 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">SalesFlow</span>
            </div>
            <h1 className="text-4xl xl:text-[2.6rem] font-extrabold leading-[1.15] tracking-tight mb-4">
              Unified Sales<br />Management Platform
            </h1>
            <p className="text-slate-300 text-base leading-relaxed max-w-md">
              Manage leads, workflows, touch points, meetings, and team communication — all in one place.
            </p>

            {/* The lead statuses people will see all day, shown in the same colours the app uses */}
            <div className="mt-10 flex flex-wrap gap-2 max-w-md">
              {[
                { label: 'New', dot: 'bg-slate-400' },
                { label: 'Discovery', dot: 'bg-emerald-400' },
                { label: 'LVM', dot: 'bg-amber-400' },
                { label: 'NVM', dot: 'bg-amber-400' },
                { label: 'No Response', dot: 'bg-rose-400' },
                { label: 'Meeting', dot: 'bg-violet-400' },
              ].map(statusStyle => (
                <span key={statusStyle.label} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-slate-200">
                  <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
                  {statusStyle.label}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {[
              { icon: Phone, text: 'Structured call workflows with touch points' },
              { icon: Users, text: 'A shared lead pool and a 15-day work window' },
              { icon: Calendar, text: 'Meeting scheduling with calendar integration' },
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-3 text-slate-300">
                <div className="w-9 h-9 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
                  <item.icon className="w-4 h-4 text-blue-300" />
                </div>
                <span className="text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-10">
        <form className="w-full max-w-md" onSubmit={event => { event.preventDefault(); void submit(); }}>
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">SalesFlow</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">Welcome back</h2>
          <p className="text-slate-600 text-sm mb-6">Sign in with your username and password</p>

          <div className="mb-4">
            <label htmlFor="login-username" className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
            <input
              id="login-username" autoFocus autoComplete="username" value={username}
              onChange={event => { setUsername(event.target.value); setError(''); }}
              placeholder="Enter your username"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            />
          </div>

          <div className="mb-5">
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <input
              id="login-password" type="password" autoComplete="current-password" value={password}
              onChange={event => { setPassword(event.target.value); setError(''); }}
              aria-invalid={!!error}
              placeholder="Enter your password"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            />
            {error && <p role="alert" className="text-xs text-rose-600 mt-1.5">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={!username.trim() || !password || busy}
            className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors active:scale-[0.99]"
          >
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
