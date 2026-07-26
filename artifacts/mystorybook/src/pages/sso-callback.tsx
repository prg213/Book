/**
 * Clerk SSO callback page — handles the redirect back from Google OAuth.
 *
 * Two contexts this page can run in:
 *
 * A) Capacitor WebView  — shouldn't happen normally since the Chrome Custom
 *    Tab handles OAuth, but if it does, AuthenticateWithRedirectCallback
 *    works as usual.
 *
 * B) Chrome Custom Tab  — the common case for Capacitor OAuth. Here the
 *    Chrome Tab's cookie jar is isolated from the WebView. After Clerk
 *    processes the callback and creates the session, we POST the session ID
 *    to /api/auth/mobile-relay keyed by the nonce the WebView stored in
 *    sessionStorage before opening the tab. The WebView polls that endpoint
 *    and calls setActive() once it gets the ID back.
 */
import { useEffect, useRef } from 'react';
import { AuthenticateWithRedirectCallback, useAuth } from '@clerk/react';

const PROD_URL = 'https://grok-canvas-copy.replit.app';
const RELAY_URL = `${PROD_URL}/api/auth/mobile-relay`;

function MobileRelayReporter() {
  const { isSignedIn, getToken } = useAuth();
  const reported = useRef(false);

  useEffect(() => {
    if (!isSignedIn || reported.current) return;

    // Retrieve the nonce the WebView wrote to sessionStorage before opening us.
    // Chrome Custom Tabs share sessionStorage with their opener on Android
    // (same-origin opener), but if not available we fall back to the URL param.
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('created_session_id');
    const nonce = params.get('relay_nonce') || sessionStorage.getItem('clerk_relay_nonce');

    if (!nonce || !sessionId) return;
    reported.current = true;

    // Fire-and-forget POST to the relay
    fetch(RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nonce, sessionId }),
    }).catch(() => { /* best-effort */ });
  }, [isSignedIn, getToken]);

  return null;
}

export default function SsoCallbackPage() {
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center"
      style={{ background: 'hsl(28,45%,97%)' }}
    >
      <div className="flex flex-col items-center gap-4">
        <span
          className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: 'hsl(15,85%,65%)', borderTopColor: 'transparent' }}
        />
        <p style={{ color: 'hsl(25,20%,50%)' }} className="text-sm">
          Completing sign-in…
        </p>
      </div>
      {/* Processes the ?__clerk_ticket / ?created_session_id params */}
      <AuthenticateWithRedirectCallback />
      {/* After auth, reports session ID to WebView via relay API */}
      <MobileRelayReporter />
    </div>
  );
}
