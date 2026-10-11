import { useEffect, useState, type ReactNode } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import type { Session } from '@supabase/supabase-js';
import { authUiClient, supabase } from '../services/supabase';
import clipvoyLogo from '../assets/clipvoy-logo.svg';

export function AuthGate({ children }: { children: ReactNode }) {
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

  if (loading) return <main className="auth-loading" role="status">Loading your account…</main>;

  if (session && !recovering) return <>
    <div className="account-bar">
      <span>{session.user.email}</span>
      <button className="close-button" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
    {children}
  </>;

  return <main className="app">
    <header className="app-header">
      <img src={clipvoyLogo} alt="ClipVoy" className="logo" />
      <span className="header-note">Podcast clipping studio</span>
    </header>
    <div className="workspace auth-workspace">
      <section className="intro" aria-labelledby="auth-title">
        <h1 id="auth-title">Your next great clip<br />starts here.</h1>
        <p className="intro-copy">Create your account to turn long conversations into clips for TikTok, Reels, and YouTube Shorts.</p>
        <div className="workflow-note"><h2>More from every conversation</h2><p>Upload a recording, discover standout moments, and download clips ready to share.</p></div>
      </section>
      <section className="panel auth-panel" aria-labelledby="account-title">
        <h2 id="account-title">Your ClipVoy account</h2>
        <p className="muted">{recovering ? 'Choose a new password for your account.' : 'Sign up or sign in with your email and password.'}</p>
        {error && <p className="error" role="alert">{error}</p>}
        {!supabase && <p className="auth-unavailable" role="status">Signup is not available yet. You can create your account once registration is enabled.</p>}
        <fieldset className="auth-fields" disabled={!supabase} onSubmitCapture={(event) => {
          if (!supabase) event.preventDefault();
        }}>
        <Auth
          supabaseClient={authUiClient}
          view={recovering ? 'update_password' : 'sign_up'}
          providers={[]}
          redirectTo={window.location.origin + window.location.pathname}
          appearance={{ theme: ThemeSupa, variables: { default: {
            colors: { brand: '#b84319', brandAccent: '#963613', inputText: '#162d46', inputLabelText: '#52677c', inputBorder: '#cbd8e4', anchorTextColor: '#162d46' },
            fonts: { bodyFontFamily: "'Barlow', sans-serif", buttonFontFamily: "'Barlow', sans-serif", inputFontFamily: "'Barlow', sans-serif", labelFontFamily: "'Barlow', sans-serif" },
            radii: { borderRadiusButton: '6px', inputBorderRadius: '6px' },
          } } }}
        />
        </fieldset>
      </section>
    </div>
  </main>;
}
