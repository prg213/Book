/**
 * /api/auth/mobile-relay
 *
 * Cross-context sign-in handoff for the Capacitor Android app.
 *
 * Problem: Google blocks OAuth inside WebViews, so the flow runs in a
 * Chrome Custom Tab. But the resulting Clerk session belongs to the
 * Chrome Tab's Clerk client (separate cookie jar) — the WebView can
 * never activate it by session ID alone.
 *
 * Solution: exchange the session for a single-use Clerk *sign-in token*
 * via the Backend API. The WebView redeems it with
 * signIn.create({ strategy: 'ticket' }) on ITS OWN Clerk client, which
 * creates a fresh session bound to the WebView. This is Clerk's
 * supported mechanism for cross-client handoff.
 *
 * Flow:
 *  1. WebView starts OAuth with redirectUrl ?relay_nonce=<128-bit hex>.
 *  2. Chrome Tab finishes OAuth → sso-callback page POSTs
 *     { nonce, sessionId } here.
 *  3. Server verifies the session with Clerk's Backend API, mints a
 *     sign-in token for that user, stores it under the nonce (60 s TTL,
 *     consume-once).
 *  4. WebView polls GET ?nonce=<n> → { ticket } → redeems locally.
 */
import { Router } from 'express';
import { clerkClient } from '@clerk/express';

const router = Router();

interface Entry { ticket: string; expiresAt: number }
const store = new Map<string, Entry>();
// sessionId → ticket cache: the callback page may POST the same session
// several times (retries / double-render). Mint one ticket per session.
const minted = new Map<string, Entry>();

// Nonce must be the exact 128-bit hex string the app generated. This also
// forbids any shared/guessable slot ('latest', etc.) — every exchange is
// bound to one unguessable per-attempt key.
const NONCE_RE = /^[0-9a-f]{32}$/;

// Rate limits: bound Clerk API lookups from unauthenticated callers, but
// count the strict mint quota only on SUCCESSFUL verification — otherwise
// garbage POSTs could exhaust the counter and lock real users out.
let lookupsThisMinute = 0;
let mintsThisMinute = 0;
setInterval(() => { lookupsThisMinute = 0; mintsThisMinute = 0; }, 60_000).unref?.();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) if (v.expiresAt < now) store.delete(k);
  for (const [k, v] of minted) if (v.expiresAt < now) minted.delete(k);
}, 10_000).unref?.();

// POST { nonce: string, sessionId: string } → verify + mint + store
router.post('/', async (req, res) => {
  const { nonce, sessionId } = req.body ?? {};
  if (
    typeof nonce !== 'string' || !NONCE_RE.test(nonce) ||
    typeof sessionId !== 'string' || !sessionId.startsWith('sess_')
  ) {
    res.status(400).json({ error: 'invalid nonce or sessionId' });
    return;
  }

  try {
    let entry = minted.get(sessionId);
    if (!entry) {
      if (lookupsThisMinute >= 120 || mintsThisMinute >= 30) {
        res.status(429).json({ error: 'rate limited' });
        return;
      }
      lookupsThisMinute++;

      // Verify the session is real and active before minting anything.
      const session = await clerkClient.sessions.getSession(sessionId);
      if (session.status !== 'active') {
        res.status(400).json({ error: `session not active (${session.status})` });
        return;
      }
      mintsThisMinute++; // only verified mints count against the strict cap

      const tok = await clerkClient.signInTokens.createSignInToken({
        userId: session.userId,
        expiresInSeconds: 300,
      });
      entry = { ticket: tok.token, expiresAt: Date.now() + 60_000 };
      minted.set(sessionId, entry);
      console.log('[mobile-relay] minted sign-in ticket for', session.userId);
    }

    store.set(nonce, { ...entry });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[mobile-relay] ticket exchange failed:',
      e?.errors?.[0]?.message ?? e?.message ?? e);
    res.status(502).json({ error: 'ticket exchange failed' });
  }
});

// GET ?nonce=<n> → { ticket: string | null }
router.get('/', (req, res) => {
  // no-store is critical: WebView polls this URL repeatedly; any HTTP
  // caching turns the poll into a stream of stale 304 nulls.
  res.setHeader('Cache-Control', 'no-store');
  const nonce = String(req.query.nonce ?? '');
  if (!NONCE_RE.test(nonce)) {
    res.json({ ticket: null });
    return;
  }
  const entry = store.get(nonce);
  if (!entry || entry.expiresAt < Date.now()) {
    res.json({ ticket: null });
    return;
  }
  store.delete(nonce); // consume once
  res.json({ ticket: entry.ticket });
});

export default router;
