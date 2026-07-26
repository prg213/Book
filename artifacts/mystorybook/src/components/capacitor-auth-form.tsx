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

    setError('');
    setGoogleLoading(true);


    // Unique nonce for this OAuth attempt — threaded through the redirect URL
    // so the sso-callback page can key its relay POST, and we can poll for it.
    const nonce = Array.from(
      crypto.getRandomValues(new Uint8Array(16))
    ).map(b => b.toString(16).padStart(2, '0')).join('');
    const relayUrl = `${PROD_URL}/api/auth/mobile-relay`;

    // Listeners we must clean up on exit
    let urlListenerHandle: { remove: () => Promise<void> } | null = null;
    let finishedListenerHandle: { remove: () => Promise<void> } | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    // Guard: prevents double-completion
    let oauthHandled = false;

    const cleanup = async () => {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      await urlListenerHandle?.remove();
      await finishedListenerHandle?.remove();
      urlListenerHandle = null;
      finishedListenerHandle = null;
    };

    // Completes sign-in once the OAuth session exists: closes the tab,
    // activates the session in THIS WebView, and navigates home.
    const finishSignIn = async (sessionId: string) => {
      if (oauthHandled) return;
      oauthHandled = true;
      await cleanup();
      try { await Browser.close(); } catch { /* already closed */ }
      try {
        await setSignInActive?.({ session: sessionId });
        window.location.replace(basePath || '/');
      } catch (e: any) {
        setError(e?.errors?.[0]?.longMessage ?? e?.message ?? 'Could not activate session.');
        setGoogleLoading(false);
      }
    };

    try {
      // 1. Listen for the App Links callback BEFORE opening the browser.
      //    Android fires appUrlOpen when it intercepts the Clerk redirect to
      //    https://grok-canvas-copy.replit.app/sso-callback (verified via
      //    assetlinks.json) and routes it back into this app.
      urlListenerHandle = await App.addListener('appUrlOpen', async (data) => {
        if (!data.url.startsWith(SSO_CALLBACK_URL)) return;
        // Clerk's callback includes ?created_session_id=... — activate it
        // directly instead of loading the web sso-callback page.
        try {
          const sid = new URL(data.url).searchParams.get('created_session_id');
          if (sid) { await finishSignIn(sid); return; }
        } catch { /* fall through to polling */ }
      });

      // 2. If the user closes the tab without signing in, reset the button.
      //    Skip if App Links already handled the flow (oauthHandled = true).
      finishedListenerHandle = await Browser.addListener('browserFinished', async () => {
        if (oauthHandled) return; // App Links fired first — don't reset
        await cleanup();
        setGoogleLoading(false);
      });

      // 3. Ask Clerk for the Google OAuth URL.
      //    NOTE: redirectUrlComplete is NOT a valid param for signIn.create()
      //    — passing it made Clerk return a swallowed 422 (form_param_unknown)
      //    which was the root cause of every silent OAuth failure.
      // Include the nonce in the redirect URL so the sso-callback page can
      // key its relay POST. Clerk appends its own params (?created_session_id)
      // to whatever redirect URL we provide, preserving our query string.
      const attempt = await signIn.create({
        strategy: 'oauth_google',
        redirectUrl: `${SSO_CALLBACK_URL}?relay_nonce=${nonce}`,
      });
      // Clerk may resolve with a { result, error } wrapper instead of the
      // SignIn resource itself — unwrap it. If the wrapper is empty, fall back
      // to the signIn resource, which Clerk mutates in place.
      let a = attempt as any;
      if (a && ('result' in a || 'error' in a)) {
        if (a.error) throw a.error;
        a = a.result ?? signIn;
      }
      const ffv = a?.firstFactorVerification;
      const oauthUrl: string | null | undefined =
        ffv?.externalVerificationRedirectURL;
      if (!oauthUrl) {
        // Surface everything Clerk gave us so the real failure isn't swallowed
        let raw = '';
        try { raw = JSON.stringify(attempt).slice(0, 400); } catch { raw = 'unserializable'; }
        const dbg = {
          status: a?.status,
          ffvStatus: ffv?.status,
          ffvStrategy: ffv?.strategy,
          ffvError: ffv?.error
            ? { code: ffv.error.code, message: ffv.error.longMessage ?? ffv.error.message }
            : null,
          signInStatus: (signIn as any)?.status,
          raw,
        };
        throw new Error('No OAuth URL. Debug: ' + JSON.stringify(dbg));
      }

      // 4. Rewrite the OAuth URL to go through the Clerk proxy.
      //    In production, Replit-managed Clerk runs behind a proxy at
      //    PROD_URL/api/__clerk — Clerk's own domains (accounts.<domain>,
      //    clerk.<domain>) don't actually exist and refuse connections.
      let finalUrl = String(oauthUrl);
      try {
        const u = new URL(finalUrl);
        const prodHost = new URL(PROD_URL).hostname;
        // Only fix hostnames the proxy mangled onto OUR domain (e.g.
        // accounts.grok-canvas-copy.replit.app). Never touch real hosts
        // like accounts.google.com.
        if (u.hostname !== prodHost && u.hostname.endsWith(`.${prodHost}`)) {
          if (u.pathname.startsWith('/o/oauth2')) {
            // Google's authorize endpoint with a mangled host — restore it.
            finalUrl = `https://accounts.google.com${u.pathname}${u.search}${u.hash}`;
          } else {
            // Clerk FAPI endpoint — route through the production proxy.
            finalUrl = `${PROD_URL}/api/__clerk${u.pathname}${u.search}${u.hash}`;
          }
        }
      } catch { /* leave as-is if unparseable */ }

      // 5. Open in Chrome Custom Tab (real browser — no WebView restrictions).
      //    After auth, Clerk redirects to our sso-callback URL, which Android
      //    App Links routes back into the app.
      await Browser.open({ url: finalUrl, presentationStyle: 'popover' });

      // 6. Relay poll: once Google OAuth completes in the Chrome Custom Tab,
      //    the sso-callback page POSTs {nonce, sessionId} to the relay.
      //    We poll here and activate the session directly in this WebView
      //    — completely independent of App Links or cookie sharing.
      const startedAt = performance.now();
      pollTimer = setInterval(async () => {
        if (oauthHandled) return;
        if (performance.now() - startedAt > 3 * 60 * 1000) {
          await cleanup();
          setGoogleLoading(false);
          return;
        }
        try {
          // Poll with our nonce first; also try 'latest' in case Clerk
          // didn't preserve the relay_nonce query param in the redirect URL.
          let sessionId: string | null = null;
          for (const key of [nonce, 'latest']) {
            const resp = await fetch(`${relayUrl}?nonce=${key}`);
            if (!resp.ok) continue;
            const data = await resp.json() as { sessionId: string | null };
            if (data.sessionId) { sessionId = data.sessionId; break; }
          }
          if (sessionId) await finishSignIn(sessionId);
        } catch { /* transient network error — keep polling */ }
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
        <button style={googleBtnStyle} onClick={handleGoogle}>
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
