/**
 * Clerk SSO callback page.
 *
 * Two contexts:
 *
 * A) Chrome Custom Tab (Capacitor OAuth flow)
 *    Detected by: created_session_id in URL AND window.Capacitor not present.
 *    The session already exists on Clerk's servers. We POST the ID to the
 *    server relay so the WebView can activate it, then show "Returning…".
 *    We deliberately do NOT run AuthenticateWithRedirectCallback here because
 *    it would issue a redirect to accounts.* which causes ERR_CONNECTION_CLOSED.
 *
 * B) Normal browser / Capacitor WebView
 *    Run AuthenticateWithRedirectCallback as usual.
 */
import { useEffect, useRef, useState } from 'react';
import { AuthenticateWithRedirectCallback } from '@clerk/react';

const PROD_URL = 'https://grok-canvas-copy.replit.app';
const RELAY_URL = `${PROD_URL}/api/auth/mobile-relay`;

function isInCapacitorWebView(): boolean {
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

export default function SsoCallbackPage() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('created_session_id');
  // Use relay_nonce if Clerk preserved it, fall back to 'latest' key so the
  // WebView can also poll the nonce-less slot.
  const nonce = params.get('relay_nonce') || 'latest';

  // Chrome Custom Tab: has a session ID and is NOT running inside Capacitor.
  const isRelayFlow = !!(sessionId && !isInCapacitorWebView());

  const posted = useRef(false);
  const [relayDone, setRelayDone] = useState(false);
  const [relayError, setRelayError] = useState('');

  useEffect(() => {
    if (!isRelayFlow || posted.current) return;
    posted.current = true;

    fetch(RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nonce, sessionId }),
    })
      .then(r => {
        if (!r.ok) throw new Error(`relay ${r.status}`);
        setRelayDone(true);
        // Also store under 'latest' so the WebView can poll without the nonce
        if (nonce !== 'latest') {
          return fetch(RELAY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nonce: 'latest', sessionId }),
          });
        }
      })
      .catch(err => setRelayError(err.message));
  }, []);

  const Spinner = () => (
    <span
      className="h-10 w-10 animate-spin rounded-full border-4"
      style={{ borderColor: 'hsl(15,85%,65%)', borderTopColor: 'transparent' }}
    />
  );

  if (isRelayFlow) {
    return (
      <div
        className="flex min-h-[100dvh] items-center justify-center"
        style={{ background: 'hsl(28,45%,97%)' }}
      >
        <div className="flex flex-col items-center gap-4">
          {relayDone ? (
            <>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="20" fill="hsl(15,85%,65%)" />
                <path d="M12 20l6 6 10-12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p style={{ color: 'hsl(25,20%,50%)' }} className="text-sm">
                Returning to app…
              </p>
            </>
          ) : relayError ? (
            <>
              <Spinner />
              <p style={{ color: 'hsl(0,60%,60%)' }} className="text-sm text-center px-6">
                Almost there… ({relayError})
              </p>
            </>
          ) : (
            <>
              <Spinner />
              <p style={{ color: 'hsl(25,20%,50%)' }} className="text-sm">
                Completing sign-in…
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center"
      style={{ background: 'hsl(28,45%,97%)' }}
    >
      <div className="flex flex-col items-center gap-4">
        <Spinner />
        <p style={{ color: 'hsl(25,20%,50%)' }} className="text-sm">
          Completing sign-in…
        </p>
      </div>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
