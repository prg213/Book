/**
 * Clerk SSO callback page.
 *
 * Two contexts:
 *
 * A) created_session_id + relay_nonce in URL (Capacitor Chrome Custom Tab)
 *    The session already exists on Clerk's servers — we don't need to run
 *    AuthenticateWithRedirectCallback. Just POST the ID to the relay so the
 *    WebView can activate it, then show "Returning to app…".
 *    Skipping AWRC prevents it from issuing a redirect to accounts.* which
 *    was causing ERR_CONNECTION_CLOSED.
 *
 * B) Everything else (normal browser, or WebView with __clerk_ticket)
 *    Run AuthenticateWithRedirectCallback as usual.
 */
import { useEffect, useRef, useState } from 'react';
import { AuthenticateWithRedirectCallback } from '@clerk/react';

const PROD_URL = 'https://grok-canvas-copy.replit.app';
const RELAY_URL = `${PROD_URL}/api/auth/mobile-relay`;

export default function SsoCallbackPage() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('created_session_id');
  const nonce = params.get('relay_nonce');

  // If both are present we're in the Chrome Custom Tab Capacitor flow.
  const isRelayFlow = !!(sessionId && nonce);

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
      })
      .catch(err => setRelayError(err.message));
  }, []);

  const spinner = (
    <span
      className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
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
              {spinner}
              <p style={{ color: 'hsl(0,60%,60%)' }} className="text-sm text-center px-6">
                Almost there… ({relayError})
              </p>
            </>
          ) : (
            <>
              {spinner}
              <p style={{ color: 'hsl(25,20%,50%)' }} className="text-sm">
                Completing sign-in…
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Normal browser / WebView flow — let Clerk handle the callback.
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center"
      style={{ background: 'hsl(28,45%,97%)' }}
    >
      <div className="flex flex-col items-center gap-4">
        {spinner}
        <p style={{ color: 'hsl(25,20%,50%)' }} className="text-sm">
          Completing sign-in…
        </p>
      </div>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
