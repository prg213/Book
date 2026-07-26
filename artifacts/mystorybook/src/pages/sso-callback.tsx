/**
 * Clerk SSO callback page.
 *
 * Two contexts:
 *
 * A) Chrome Custom Tab (Capacitor OAuth relay flow)
 *    Detected by: created_session_id AND relay_nonce in the URL, and NOT
 *    running inside the Capacitor WebView. The relay_nonce requirement
 *    protects the normal desktop/web OAuth flow, which must never take
 *    this branch.
 *
 *    The page POSTs { nonce, sessionId } to the server relay, which
 *    exchanges it for a single-use Clerk sign-in ticket. The app's WebView
 *    polls for that ticket and signs in on its own Clerk client. We then
 *    bounce back to the app via an intent:// URL (Chrome resolves it to
 *    the app because the manifest declares App Links for /sso-callback).
 *
 *    We deliberately do NOT run AuthenticateWithRedirectCallback here —
 *    it would redirect to accounts.* which doesn't exist for the proxy
 *    setup (ERR_CONNECTION_CLOSED).
 *
 * B) Normal browser / Capacitor WebView
 *    Run AuthenticateWithRedirectCallback as usual.
 */
import { useEffect, useRef, useState } from 'react';
import { AuthenticateWithRedirectCallback } from '@clerk/react';

const PROD_URL = 'https://grok-canvas-copy.replit.app';
const RELAY_URL = `${PROD_URL}/api/auth/mobile-relay`;
const ANDROID_PACKAGE = 'com.mystorybook.app';

// intent:// URI — the reliable way to hop from a Chrome Custom Tab back into
// the app. Chrome resolves it against the app's verified App Links intent
// filter. relay_done=1 (no created_session_id) means the app's appUrlOpen
// listener just foregrounds the app without re-posting anything.
const RETURN_INTENT_URL =
  `intent://${new URL(PROD_URL).host}/sso-callback?relay_done=1` +
  `#Intent;scheme=https;package=${ANDROID_PACKAGE};` +
  `S.browser_fallback_url=${encodeURIComponent(PROD_URL)};end`;

function isInCapacitorWebView(): boolean {
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

export default function SsoCallbackPage() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('created_session_id');
  const relayNonce = params.get('relay_nonce');

  // Chrome Custom Tab relay flow ONLY: session ID + our nonce, outside
  // the Capacitor WebView. Desktop web OAuth has no relay_nonce and falls
  // through to AuthenticateWithRedirectCallback below.
  const isRelayFlow = !!(sessionId && relayNonce && !isInCapacitorWebView());

  const posted = useRef(false);
  const [relayDone, setRelayDone] = useState(false);
  const [relayError, setRelayError] = useState('');

  useEffect(() => {
    if (!isRelayFlow || posted.current) return;
    posted.current = true;

    fetch(RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nonce: relayNonce, sessionId }),
    })
      .then(async r => {
        if (!r.ok) throw new Error(`relay ${r.status}`);
        // Fill the nonce-less slot too, in case the redirect lost our param
        await fetch(RELAY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nonce: 'latest', sessionId }),
        }).catch(() => { /* best effort */ });
        setRelayDone(true);
        // Bounce back into the app. JS-initiated intent navigations are
        // sometimes blocked without a user gesture — the visible button
        // below is the fallback.
        setTimeout(() => { window.location.href = RETURN_INTENT_URL; }, 400);
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
        <div className="flex flex-col items-center gap-4 px-6">
          {relayDone ? (
            <>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="20" fill="hsl(15,85%,65%)" />
                <path d="M12 20l6 6 10-12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p style={{ color: 'hsl(25,20%,50%)' }} className="text-sm">
                Signed in! Returning to the app…
              </p>
              <a
                href={RETURN_INTENT_URL}
                className="mt-2 rounded-full px-6 py-3 text-sm font-semibold text-white"
                style={{ background: 'hsl(15,85%,65%)' }}
              >
                Open MyStoryBook
              </a>
            </>
          ) : relayError ? (
            <>
              <Spinner />
              <p style={{ color: 'hsl(0,60%,60%)' }} className="text-sm text-center">
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
