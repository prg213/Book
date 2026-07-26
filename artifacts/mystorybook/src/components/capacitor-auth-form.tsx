/**
 * Custom auth form for Capacitor (Android/iOS).
 * Uses Clerk hooks directly — no pre-built <SignIn>/<SignUp> components.
 *
 * Google OAuth flow:
 *  1. Open Clerk Account Portal in Chrome Custom Tab (Browser.open)
 *  2. User signs in with Google in the real browser — no WebView restrictions
 *  3. Clerk redirects to mystorybook://sso-callback?__clerk_ticket=...
 *  4. Android fires appUrlOpen; we close the tab and hand params to Clerk JS
 */
import { useState } from 'react';
import { useSignIn, useSignUp } from '@clerk/react';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';

type Mode = 'sign-in' | 'sign-up' | 'verify';

// The deployed production URL — used for OAuth redirects.
// window.location.origin is unreliable inside Capacitor WebView.
const PROD_URL = 'https://grok-canvas-copy.replit.app';

// The sso-callback URL Clerk redirects to after OAuth.
// Android App Links (assetlinks.json) intercept this HTTPS URL and route it
// back into the app — no custom URL scheme needed, and Clerk dev instances
// accept HTTPS redirect URLs without any dashboard configuration.
const SSO_CALLBACK_URL = `${PROD_URL}/sso-callback`;

export function CapacitorAuthForm({ initialMode = 'sign-in' }: { initialMode?: 'sign-in' | 'sign-up' }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn, setActive: setSignInActive } = useSignIn();
  const { signUp, setActive: setSignUpActive } = useSignUp();

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

  /* ── Google ──────────────────────────────────────────────────────── */
  const handleGoogle = async () => {
    if (!signIn) { setError('Clerk not loaded — try again.'); return; }
    if (googleLoading) return; // re-entry guard: one attempt at a time

    setError('');
    setGoogleLoading(true);

    const nonce = Array.from(
      crypto.getRandomValues(new Uint8Array(16))
    ).map(b => b.toString(16).padStart(2, '0')).join('');
    const relayUrl = `${PROD_URL}/api/auth/mobile-relay`;

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let urlHandle: { remove: () => Promise<void> } | null = null;
    let finishedHandle: { remove: () => Promise<void> } | null = null;
    let resumeHandle: { remove: () => Promise<void> } | null = null;
    let done = false;
    // Poll deadline — browserFinished shortens it instead of killing the poll
    let deadline = Number.MAX_SAFE_INTEGER;

    const cleanup = async () => {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      await urlHandle?.remove();
      await finishedHandle?.remove();
      await resumeHandle?.remove();
      urlHandle = finishedHandle = resumeHandle = null;
    };

    // Redeem the sign-in ticket on THIS WebView's own Clerk client.
    // The Chrome Tab's session can never be activated here (separate cookie
    // jars = separate Clerk clients), but a sign-in token is client-agnostic:
    // signIn.create({ strategy:'ticket' }) creates a NEW session bound to the
    // WebView. No navigation to remote URLs, no cookie sharing needed.
    const redeem = async (ticket: string) => {
      if (done) return;
      done = true;
      await cleanup();
      try { await Browser.close(); } catch { /* Android: not implemented — tab bounces back via intent */ }
      try {
        const attempt = await signIn.create({ strategy: 'ticket', ticket } as any);
        let a = attempt as any;
        if (a && ('result' in a || 'error' in a)) {
          if (a.error) throw a.error;
          a = a.result ?? signIn;
        }
        const sid: string | undefined = a?.createdSessionId;
        if (!sid) throw new Error(`Ticket sign-in incomplete (status: ${a?.status ?? 'unknown'})`);
        await setSignInActive?.({ session: sid });
        window.location.replace(basePath || '/');
      } catch (e: any) {
        setError(e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? e?.message ?? 'Could not complete sign-in.');
        setGoogleLoading(false);
      }
    };

    // One poll tick — also called immediately on app resume so sign-in
    // completes the instant the user lands back in the app.
    // Poll ONLY our own nonce: a shared fallback slot (e.g. 'latest') would
    // let concurrent sign-ins swap tickets — wrong-account sign-in.
    const pollOnce = async () => {
      if (done) return;
      try {
        const resp = await fetch(`${relayUrl}?nonce=${nonce}`, { cache: 'no-store' });
        if (!resp.ok) return;
        const data = await resp.json() as { ticket: string | null };
        if (data.ticket) await redeem(data.ticket);
      } catch { /* transient — retry next tick */ }
    };

    try {
      // appUrlOpen: Android App Links may intercept the OAuth callback before
      // the Chrome Tab loads our page. If so, WE post the session ID to the
      // relay ourselves; the server exchanges it for a ticket and the poll
      // picks it up. CRITICAL: never navigate the WebView to the callback URL
      // — that unloads the app (and its poll) mid-flow.
      urlHandle = await App.addListener('appUrlOpen', (data) => {
        if (!data.url.startsWith(SSO_CALLBACK_URL)) return;
        try {
          const sid = new URL(data.url).searchParams.get('created_session_id');
          if (sid) {
            fetch(relayUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nonce, sessionId: sid }),
            }).then(() => pollOnce()).catch(() => { /* poll continues anyway */ });
          }
        } catch { /* unparseable URL — poll continues */ }
      });

      // resume: app came back to foreground (intent bounce or manual return)
      // — poll immediately instead of waiting for the next throttled tick.
      resumeHandle = await App.addListener('resume', () => { void pollOnce(); });

      // browserFinished: tab closed. Sign-in may still be landing (the relay
      // fills ~1-2s after the redirect), so give it 12 more seconds of
      // polling before resetting the button instead of bailing instantly.
      finishedHandle = await Browser.addListener('browserFinished', () => {
        deadline = Math.min(deadline, performance.now() + 12_000);
        void pollOnce();
      });

      // Ask Clerk for the Google OAuth redirect URL.
      const attempt = await signIn.create({
        strategy: 'oauth_google',
        redirectUrl: `${SSO_CALLBACK_URL}?relay_nonce=${nonce}`,
      });
      let a = attempt as any;
      if (a && ('result' in a || 'error' in a)) {
        if (a.error) throw a.error;
        a = a.result ?? signIn;
      }
      const ffv = a?.firstFactorVerification;
      const oauthUrl: string | null | undefined = ffv?.externalVerificationRedirectURL;
      if (!oauthUrl) {
        let raw = '';
        try { raw = JSON.stringify(attempt).slice(0, 300); } catch { raw = 'unserializable'; }
        throw new Error(`No OAuth URL — ${JSON.stringify({ ffvStatus: ffv?.status, ffvError: ffv?.error, raw })}`);
      }

      // Rewrite mangled proxy subdomains back to their real hosts.
      let finalUrl = String(oauthUrl);
      try {
        const u = new URL(finalUrl);
        const prodHost = new URL(PROD_URL).hostname;
        if (u.hostname !== prodHost && u.hostname.endsWith(`.${prodHost}`)) {
          finalUrl = u.pathname.startsWith('/o/oauth2')
            ? `https://accounts.google.com${u.pathname}${u.search}${u.hash}`
            : `${PROD_URL}/api/__clerk${u.pathname}${u.search}${u.hash}`;
        }
      } catch { /* leave as-is */ }

      await Browser.open({ url: finalUrl, presentationStyle: 'popover' });

      // Relay poll: the server exchanges the Chrome Tab's session ID for a
      // single-use sign-in ticket; we redeem it here on the WebView's client.
      // cache:'no-store' is critical — without it the browser serves stale
      // 304 nulls even after the relay has been filled.
      deadline = performance.now() + 3 * 60 * 1000;
      pollTimer = setInterval(async () => {
        if (done) { if (pollTimer) clearInterval(pollTimer); return; }
        if (performance.now() > deadline) {
          await cleanup();
          setGoogleLoading(false);
          return;
        }
        await pollOnce();
      }, 1500);

    } catch (e: any) {
      await cleanup();
      const msg = e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? e?.message ?? String(e);
      setError(msg);
      setGoogleLoading(false);
    }
  };

  /* ── Sign In ─────────────────────────────────────────────────────── */
  const handleSignIn = async () => {
    if (!signIn || !setSignInActive) return;
    setError('');
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
        window.location.replace(basePath || '/');
      } else {
        setError('Sign-in incomplete — please try again.');
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Sign Up ─────────────────────────────────────────────────────── */
  const handleSignUp = async () => {
    if (!signUp) return;
    setError('');
    setLoading(true);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setMode('verify');
    } catch (e: any) {
      setError(e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? 'Could not create account.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Verify email ────────────────────────────────────────────────── */
  const handleVerify = async () => {
    if (!signUp || !setSignUpActive) return;
    setError('');
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await setSignUpActive({ session: result.createdSessionId });
        window.location.replace(basePath || '/');
      } else {
        setError('Verification incomplete — please try again.');
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Styles ──────────────────────────────────────────────────────── */
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    border: '1.5px solid hsl(28,25%,88%)', background: '#fff',
    color: 'hsl(25,30%,20%)', fontSize: 16, outline: 'none',
    boxSizing: 'border-box', WebkitAppearance: 'none',
  };
  const primaryBtnStyle: React.CSSProperties = {
    width: '100%', padding: '14px', borderRadius: 14,
    background: 'hsl(15,85%,65%)', color: '#fff', fontSize: 16,
    fontWeight: 700, border: 'none', cursor: 'pointer',
    touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
  };
  const googleBtnStyle: React.CSSProperties = {
    width: '100%', padding: '13px', borderRadius: 14,
    border: '1.5px solid hsl(28,25%,88%)', background: '#fff',
    color: 'hsl(25,30%,20%)', fontSize: 15, fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 10,
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'rgba(240,123,82,0.12)',
  };
  const linkStyle: React.CSSProperties = {
    color: 'hsl(15,85%,60%)', fontWeight: 600, cursor: 'pointer',
    background: 'none', border: 'none', fontSize: 14,
    touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
  };

  /* ── Verify screen ───────────────────────────────────────────────── */
  if (mode === 'verify') {
    return (
      <Card title="Check your email" subtitle={`We sent a 6-digit code to ${email}`}>
        <input style={inputStyle} type="text" inputMode="numeric"
          placeholder="Enter code" value={code}
          onChange={e => setCode(e.target.value)} maxLength={6} />
        {error && <ErrorMsg>{error}</ErrorMsg>}
        <button style={primaryBtnStyle} onClick={handleVerify}>
          {loading ? 'Verifying…' : 'Verify Email'}
        </button>
        <p style={{ textAlign: 'center', fontSize: 14, color: 'hsl(25,20%,50%)' }}>
          Wrong email?{' '}
          <button style={linkStyle} onClick={() => setMode('sign-up')}>Go back</button>
        </p>
      </Card>
    );
  }

  const isSignIn = mode === 'sign-in';

  return (
    <>
      <Card
        title={isSignIn ? 'Welcome back 📖' : 'Create account ✨'}
        subtitle={isSignIn ? 'Sign in to see your storybooks' : 'Start building magical storybooks'}
      >
        {/* Google */}
        <button style={googleBtnStyle} onClick={handleGoogle} disabled={googleLoading}>
          {googleLoading ? <Spinner /> : <GoogleLogo />}
          <span>{googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}</span>
        </button>

        <Divider />

        {/* Email + Password */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input style={inputStyle} type="email" inputMode="email"
            autoCapitalize="none" placeholder="Email address"
            value={email} onChange={e => setEmail(e.target.value)} />
          <input style={inputStyle} type="password" placeholder="Password"
            value={password} onChange={e => setPassword(e.target.value)} />
        </div>

        {error && <ErrorMsg>{error}</ErrorMsg>}

        <button
          style={{ ...primaryBtnStyle, opacity: loading ? 0.7 : 1 }}
          onClick={isSignIn ? handleSignIn : handleSignUp}
        >
          {loading
            ? (isSignIn ? 'Signing in…' : 'Creating account…')
            : (isSignIn ? 'Continue' : 'Create Account')}
        </button>

        <p style={{ textAlign: 'center', fontSize: 14, color: 'hsl(25,20%,50%)' }}>
          {isSignIn ? "Don't have an account? " : 'Already have an account? '}
          <button style={linkStyle} onClick={() => { setMode(isSignIn ? 'sign-up' : 'sign-in'); setError(''); }}>
            {isSignIn ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </Card>
    </>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{
      width: '100%', maxWidth: 440, background: '#fff', borderRadius: 20,
      padding: '32px 28px', boxShadow: '0 8px 32px rgba(240,123,82,0.12)',
      display: 'flex', flexDirection: 'column', gap: 16, boxSizing: 'border-box',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'hsl(25,30%,20%)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 14, color: 'hsl(25,20%,50%)' }}>{subtitle}</div>
      </div>
      {children}
    </div>
  );
}
function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, height: 1, background: 'hsl(28,25%,88%)' }} />
      <span style={{ fontSize: 12, color: 'hsl(25,20%,50%)' }}>or</span>
      <div style={{ flex: 1, height: 1, background: 'hsl(28,25%,88%)' }} />
    </div>
  );
}
function ErrorMsg({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: 'hsl(0,72%,51%)', textAlign: 'center', margin: 0 }}>{children}</p>;
}
function Spinner() {
  return <span style={{ width: 18, height: 18, border: '2px solid hsl(15,85%,65%)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />;
}
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
