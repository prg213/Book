---
name: Clerk OAuth in Capacitor WebView
description: Root cause and working pattern for Google OAuth in the Android APK (Capacitor + Clerk dev instance)
---

**Rule:** `signIn.create({ strategy: 'oauth_google' })` accepts `redirectUrl` but NOT `redirectUrlComplete`. Passing `redirectUrlComplete` makes Clerk return a swallowed 422 (`form_param_unknown`) — the SDK resolves with `{ error }` instead of throwing, so the failure is silent (`externalVerificationRedirectURL` looks null).

**Why:** Weeks of "OAuth silently does nothing in the WebView" traced to this one invalid param. Debug by displaying `Object.keys(result)` and `result.error` on-device — Clerk errors don't always throw.

**How to apply:** For mobile OAuth: `signIn.create({ strategy, redirectUrl })` → open `firstFactorVerification.externalVerificationRedirectURL` in Chrome Custom Tab (`@capacitor/browser`), return via Android App Links (HTTPS sso-callback URL + `assetlinks.json` + fixed PKCS12 signing keystore committed in android-extras, restored in the GitHub Actions build). Clerk dev instances refuse Account Portal redirects to non-localhost URLs and reject custom URL schemes — don't retry those paths.

**Cross-context session handoff (the big one):**
- Clerk sessions are CLIENT-BOUND. The Chrome Custom Tab and the Capacitor WebView have separate cookie jars = separate Clerk clients. A session created in the tab can NEVER be activated in the WebView by session ID — `setActive({session})`, `signIn.reload()` polling, and navigating to `/sso-callback?created_session_id=` all fail for this reason.
- The ONLY reliable handoff: server exchanges the tab's session ID for a single-use **sign-in token** via Clerk Backend API (`sessions.getSession` to verify + `signInTokens.createSignInToken`), and the WebView redeems it with `signIn.create({ strategy: 'ticket', ticket })` — creates a fresh session on the WebView's own client. Backend API at api.clerk.com works with the Replit-managed CLERK_SECRET_KEY.
- NEVER navigate the WebView to the remote sso-callback URL mid-flow — it unloads the app page, killing the relay poll and any listeners.

Other constraints learned:
- The proxy also mangles hosts *inside* FAPI responses (accounts.google.com → accounts.<domain>) and in redirect Location headers — fix both client-side (restore Google host) and server-side (rewrite Location in the proxy middleware).
- `signIn.create()` may resolve with a `{ result, error }` envelope (both possibly null) instead of the SignIn resource — unwrap it and fall back to the mutated `signIn` hook resource.
- Replit-managed Clerk in production runs behind a proxy at `<prod-url>/api/__clerk`; Clerk's `accounts.<domain>` / `clerk.<domain>` hosts don't exist. Rewrite any Clerk-generated OAuth URL origin to the proxy before opening it.
- Polling endpoints need `Cache-Control: no-store` (server) AND `fetch(..., {cache:'no-store'})` (client) — otherwise the WebView serves stale 304 nulls forever.
- Backgrounded WebView timers throttle to ~10s batches; add a Capacitor `resume` listener to poll immediately on foreground.
- `Browser.close()` is not implemented on Android. The reliable Chrome-Tab→app return is an `intent://<host>/<path>#Intent;scheme=https;package=<appId>;end` navigation from the tab page (resolves via the App Links intent filter); keep a visible tap-fallback button since gesture-less intent navigations are sometimes blocked.
- Android App Links interception of server-side 303 redirects is NONDETERMINISTIC (sometimes fires appUrlOpen, sometimes the tab loads the page) — both paths must converge on the same relay mechanism.
- Capacitor blocks `window.location.href` to external domains unless in `server.allowNavigation`.
- Google returns 400 for OAuth started inside a WebView even with the `wv` UA flag patched — must use Chrome Custom Tab.
- APK loads JS from the production URL: JS changes need a Replit republish; native changes (capacitor.config.ts, manifest, keystore) need a new APK from GitHub Actions.
