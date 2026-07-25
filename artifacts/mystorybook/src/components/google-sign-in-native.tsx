/**
 * A Google sign-in button that works inside Capacitor (Android WebView).
 * Uses Chrome Custom Tab via @capacitor/browser instead of the embedded WebView.
 */
import { useState } from 'react';
import { useSignIn } from '@clerk/react';
import { signInWithGoogleCustomTab } from '@/lib/google-auth-capacitor';

export function GoogleSignInNative() {
  const { signIn, isLoaded } = useSignIn();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePress = async () => {
    // Move the isLoaded check inside — never disable the button itself,
    // because disabled buttons don't receive touch events on some Android WebViews.
    if (!isLoaded || !signIn) {
      setError('Still loading — please try again in a moment.');
      return;
    }
    if (loading) return;

    setError(null);
    setLoading(true);
    try {
      await signInWithGoogleCustomTab(signIn);
    } catch (err: any) {
      console.error('Google OAuth error:', err);
      setError('Could not open Google sign-in. Please try email instead.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-2" style={{ position: 'relative', zIndex: 10 }}>
      <button
        onClick={handlePress}
        // Never disabled — Android WebView won't fire touches on disabled elements
        className="w-full flex items-center justify-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors active:scale-95"
        style={{
          background: '#fff',
          borderColor: 'hsl(28,25%,88%)',
          color: 'hsl(25,30%,20%)',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'rgba(240,123,82,0.12)',
          touchAction: 'manipulation',
        }}
      >
        {loading ? (
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: 'hsl(15,85%,65%)', borderTopColor: 'transparent' }}
          />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
        )}
        <span>{loading ? 'Opening Google…' : 'Continue with Google'}</span>
      </button>

      {error && (
        <p
          className="text-xs text-center px-2"
          style={{ color: 'hsl(0,72%,51%)' }}
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-px" style={{ background: 'hsl(28,25%,88%)' }} />
        <span className="text-xs" style={{ color: 'hsl(25,20%,50%)' }}>or continue with email</span>
        <div className="flex-1 h-px" style={{ background: 'hsl(28,25%,88%)' }} />
      </div>
    </div>
  );
}
