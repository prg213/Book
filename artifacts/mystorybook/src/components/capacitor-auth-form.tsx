/**
 * Custom auth form for Capacitor (Android/iOS).
 * Uses Clerk hooks directly — no pre-built <SignIn>/<SignUp> components.
 */
import { useState } from 'react';
import { useSignIn, useSignUp } from '@clerk/react';

type Mode = 'sign-in' | 'sign-up' | 'verify';

// The deployed production URL — used for OAuth redirects.
// window.location.origin is unreliable inside Capacitor WebView.
const PROD_URL = 'https://grok-canvas-copy.replit.app';

export function CapacitorAuthForm({ initialMode = 'sign-in' }: { initialMode?: 'sign-in' | 'sign-up' }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleAwaitingReturn, setGoogleAwaitingReturn] = useState(false);
  const [error, setError] = useState('');

  const { signIn, setActive: setSignInActive } = useSignIn();
  const { signUp, setActive: setSignUpActive } = useSignUp();

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

  /* ── Google ──────────────────────────────────────────────────────── */
  const handleGoogle = async () => {
    if (!signIn) { setError('Clerk not loaded — try again.'); return; }

    setError('');
    setGoogleLoading(true);
    setGoogleAwaitingReturn(false);

    try {
      const attempt = await (signIn as any).create({
        strategy: 'oauth_google',
        redirectUrl: `${PROD_URL}/sso-callback`,
        actionCompleteRedirectUrl: `${PROD_URL}/`,
      });

      const oauthUrl: string | undefined =
        attempt?.firstFactorVerification?.externalVerificationRedirectURL?.href;

      if (!oauthUrl) {
        throw new Error('Google sign-in is not configured. Enable Google in your Clerk dashboard under Social Connections.');
      }

      // Open in Chrome Custom Tab — avoids Google's WebView restriction.
      // Clean up any listener from a previous attempt first.
      const { Browser } = await import('@capacitor/browser');
      await Browser.removeAllListeners();
      await Browser.open({ url: oauthUrl });

      setGoogleLoading(false);
      setGoogleAwaitingReturn(true); // show "Return here when done" UI

      Browser.addListener('browserFinished', () => {
        setGoogleAwaitingReturn(false);
        // Reload so Clerk picks up the session cookie set during OAuth.
        window.location.reload();
      });

    } catch (e: any) {
      const msg = e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? e?.message ?? String(e);
      setError(msg);
      setGoogleLoading(false);
    }
  };

  const handleGoogleContinue = () => {
    setGoogleAwaitingReturn(false);
    window.location.reload();
  };

  const handleGoogleCancel = async () => {
    const { Browser } = await import('@capacitor/browser');
    await Browser.removeAllListeners();
    setGoogleAwaitingReturn(false);
    setError('');
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
        {/* Google — awaiting return from Chrome Custom Tab */}
        {googleAwaitingReturn ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              background: 'hsl(142,72%,95%)', border: '1.5px solid hsl(142,60%,70%)',
              borderRadius: 12, padding: '12px 14px', fontSize: 14,
              color: 'hsl(142,40%,25%)', textAlign: 'center',
            }}>
              🌐 Google sign-in opened.<br />Complete it, then tap <strong>Continue</strong>.
            </div>
            <button style={primaryBtnStyle} onClick={handleGoogleContinue}>
              ✓ Continue after signing in
            </button>
            <button style={{ ...googleBtnStyle, color: 'hsl(0,60%,50%)' }} onClick={handleGoogleCancel}>
              Cancel
            </button>
          </div>
        ) : (
          /* Google button */
          <button style={googleBtnStyle} onClick={handleGoogle}>
            {googleLoading ? <Spinner /> : <GoogleLogo />}
            <span>{googleLoading ? 'Opening Google…' : 'Continue with Google'}</span>
          </button>
        )}

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
