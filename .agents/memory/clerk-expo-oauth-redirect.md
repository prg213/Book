---
name: Clerk Expo OAuth redirect URL
description: Do NOT pass a custom redirectUrl to startSSOFlow when using @clerk/expo with shared Clerk credentials
---

## Rule
When calling `startSSOFlow` from `useSSO` in `@clerk/expo`, do **not** pass a custom `redirectUrl`.

## Why
The `@clerk/expo` plugin registers its own `clerk://` intent filter in `AndroidManifest.xml` (e.g. `clerk://com.mystorybook.app.hosted-callback`). When using Clerk's default (shared) OAuth credentials, Clerk controls the redirect URL entirely — passing `AuthSession.makeRedirectUri({ scheme: 'mystorybook-native' })` sends the OAuth callback to the wrong handler, causing a silent failure where the browser closes but no session is created.

The Clerk dashboard's SSO connection page for shared credentials has **no redirect URL configuration** — this confirms Clerk owns the redirect in that mode.

## How to apply
```tsx
// WRONG — overrides Clerk's clerk:// handler with the wrong scheme
const { createdSessionId } = await startSSOFlow({
  strategy: 'oauth_google',
  redirectUrl: AuthSession.makeRedirectUri({ scheme: 'myapp' }),
});

// CORRECT — let @clerk/expo handle via its registered clerk:// scheme
const { createdSessionId } = await startSSOFlow({
  strategy: 'oauth_google',
});
```

Only provide a custom `redirectUrl` if you have enabled **custom OAuth credentials** in the Clerk dashboard (which then exposes redirect URL config).
