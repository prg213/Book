---
name: Clerk OAuth in Capacitor WebView
description: Root cause and working pattern for Google OAuth in the Android APK (Capacitor + Clerk dev instance)
---

**Rule:** `signIn.create({ strategy: 'oauth_google' })` accepts `redirectUrl` but NOT `redirectUrlComplete`. Passing `redirectUrlComplete` makes Clerk return a swallowed 422 (`form_param_unknown`) — the SDK resolves with `{ error }` instead of throwing, so the failure is silent (`externalVerificationRedirectURL` looks null).

**Why:** Weeks of "OAuth silently does nothing in the WebView" traced to this one invalid param. Debug by displaying `Object.keys(result)` and `result.error` on-device — Clerk errors don't always throw.

**How to apply:** For mobile OAuth: `signIn.create({ strategy, redirectUrl })` → open `firstFactorVerification.externalVerificationRedirectURL` in Chrome Custom Tab (`@capacitor/browser`), return via Android App Links (HTTPS sso-callback URL + `assetlinks.json` + fixed PKCS12 signing keystore committed in android-extras, restored in the GitHub Actions build). Clerk dev instances refuse Account Portal redirects to non-localhost URLs and reject custom URL schemes — don't retry those paths.

Other constraints learned:
- Capacitor blocks `window.location.href` to external domains unless in `server.allowNavigation`.
- Google returns 400 for OAuth started inside a WebView even with the `wv` UA flag patched — must use Chrome Custom Tab.
- APK loads JS from the production URL: JS changes need a Replit republish; native changes (capacitor.config.ts, manifest, keystore) need a new APK from GitHub Actions.
