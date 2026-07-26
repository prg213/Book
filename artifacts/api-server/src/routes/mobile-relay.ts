/**
 * /api/auth/mobile-relay
 *
 * Tiny in-memory relay so the Capacitor WebView can receive the Clerk
 * session ID that was created in a Chrome Custom Tab (separate cookie jar).
 *
 * Flow:
 *  1. WebView opens OAuth tab, noting the sign-in attempt nonce stored here.
 *  2. Chrome Tab completes Google sign-in → /sso-callback page POSTs
 *     { nonce, sessionId } here.
 *  3. WebView polls GET /api/auth/mobile-relay?nonce=<n>, gets the
 *     sessionId back, calls setActive({ session: sessionId }).
 *
 * Security: the nonce is a random 128-bit hex string chosen by the WebView.
 * A valid sessionId can only be created by completing real Google OAuth.
 * Entries expire after 60 s to avoid accumulation.
 */
import { Router } from 'express';

const router = Router();

interface Entry { sessionId: string; expiresAt: number }
const store = new Map<string, Entry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expiresAt < now) store.delete(k);
  }
}, 10_000);

// POST { nonce: string, sessionId: string }
router.post('/', (req, res) => {
  const { nonce, sessionId } = req.body ?? {};
  if (typeof nonce !== 'string' || typeof sessionId !== 'string') {
    res.status(400).json({ error: 'nonce and sessionId are required' });
    return;
  }
  store.set(nonce, { sessionId, expiresAt: Date.now() + 60_000 });
  res.json({ ok: true });
});

// GET ?nonce=<n>
router.get('/', (req, res) => {
  const nonce = String(req.query.nonce ?? '');
  const entry = store.get(nonce);
  if (!entry || entry.expiresAt < Date.now()) {
    res.json({ sessionId: null });
    return;
  }
  store.delete(nonce); // consume once
  res.json({ sessionId: entry.sessionId });
});

export default router;
