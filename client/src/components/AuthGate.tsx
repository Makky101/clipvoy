import { useEffect, useState, type ReactNode } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import type { Session } from '@supabase/supabase-js';
import { authUiClient, supabase } from '../services/supabase';
import clipvoyLogo from '../assets/clipvoy-logo.svg';
import { BillingProvider } from './BillingProvider';

export function AuthGate({ children }: { children: (accountBar: ReactNode) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let authChanged = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authChanged = true;
      if (active) {
        if (_event === 'PASSWORD_RECOVERY') setRecovering(true);
        if (_event === 'USER_UPDATED' || _event === 'SIGNED_OUT') setRecovering(false);
        setSession(nextSession); setLoading(false);
      }
    });
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || authChanged) return;
      setSession(data.session);
      setError(sessionError?.message ?? null);
      setLoading(false);
    }).catch(() => {
      if (active && !authChanged) { setError('Unable to load your session. Please refresh and try again.'); setLoading(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function signOut() {
    if (!supabase) return;
    setSigningOut(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) setError(signOutError.message);
    } catch {
      setError('Unable to sign out. Please try again.');
    } finally { setSigningOut(false); }
  }

  if (loading) return <main className="px-6 py-16 text-center text-[#52677c]" role="status">Loading your account…</main>;

  if (session && !recovering) {
    const accountBar = (
    <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 sm:w-auto sm:justify-start sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4 [&>p]:basis-full">
      <span className="max-w-[22ch] truncate text-sm text-[#52677c]" title={session.user.email}>{session.user.email}</span>
      <button className="inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b84319] shrink-0 border border-slate-300 bg-white text-[#162d46] hover:enabled:bg-slate-50" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
      {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800 wrap-anywhere" role="alert">{error}</p>}
    </div>
    );
    return <BillingProvider key={session.user.id} userId={session.user.id}>{children(accountBar)}</BillingProvider>;
  }

  return <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-16 sm:px-8 lg:px-12">
    <header className="flex items-center justify-between gap-4 border-b border-slate-300 py-2 pb-6">
      <img src={clipvoyLogo} alt="ClipVoy" className="block h-auto w-32 sm:w-40" />
      <span className="max-w-36 text-right text-xs font-medium text-[#52677c] sm:max-w-none sm:text-sm">Podcast clipping studio</span>
    </header>
    <div className="grid grid-cols-1 items-start gap-10 py-10 lg:grid-cols-2 lg:gap-16 lg:py-16 min-h-[75vh] items-center">
      <section className="min-w-0 [&>h1]:font-['Barlow_Condensed',sans-serif] [&>h1]:text-5xl [&>h1]:font-semibold [&>h1]:leading-[1.02] [&>h1]:tracking-tight sm:[&>h1]:text-6xl xl:[&>h1]:text-7xl" aria-labelledby="auth-title">
        <h1 id="auth-title">Your next great clip<br />starts here.</h1>
        <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-[#52677c]">Start with 3 free credits. Turn long conversations into clips for TikTok, Reels, and YouTube Shorts.</p>
        <div className="mt-8 max-w-[48ch] border-l-2 border-[#b84319] pl-5 [&>h2]:text-base [&>h2]:font-semibold [&>p]:mt-2 [&>p]:text-sm [&>p]:leading-relaxed [&>p]:text-[#52677c]"><h2>More from every conversation</h2><p>Upload a recording, discover standout moments, and download clips ready to share.</p></div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 shadow-sm w-full lg:max-w-md lg:justify-self-end [&>h2]:text-2xl [&>h2]:font-semibold [&>h2]:tracking-tight" aria-labelledby="account-title">
        <h2 id="account-title">Your ClipVoy account</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#52677c]">{recovering ? 'Choose a new password for your account.' : 'Sign up or sign in with your email and password.'}</p>
        {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800 wrap-anywhere" role="alert">{error}</p>}
        {!supabase && <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-[#52677c]" role="status">Signup is not available yet. You can create your account once registration is enabled.</p>}
        <fieldset className="mt-6 min-w-0 border-0 p-0" disabled={!supabase} onSubmitCapture={(event) => {
          if (!supabase) event.preventDefault();
        }}>
        <Auth
          supabaseClient={authUiClient}
          view={recovering ? 'update_password' : 'sign_up'}
          providers={[]}
          redirectTo={window.location.origin + window.location.pathname}
          appearance={{ extend: false, className: {
            container: 'flex flex-col gap-4',
            label: 'mb-2 block text-sm font-medium text-[#162d46]',
            input: 'block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-[#162d46] placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 focus:border-[#b84319] focus:outline-2 focus:outline-offset-2 focus:outline-[#b84319]',
            button: 'inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#b84319] px-4 py-3 text-sm font-semibold text-white hover:enabled:bg-[#963613] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b84319]',
            anchor: 'block text-center text-sm text-[#52677c] underline underline-offset-4 hover:text-[#162d46] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b84319]',
            divider: 'my-2 border-t border-slate-200',
            message: 'rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-[#162d46] wrap-anywhere',
            loader: 'size-4 motion-safe:animate-spin',
          } }}
        />
        </fieldset>
      </section>
    </div>
  </main>;
}
