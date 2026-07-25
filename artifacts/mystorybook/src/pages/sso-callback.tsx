/**
 * Clerk SSO callback page — handles the redirect back from Google OAuth.
 * Clerk processes the ?__clerk_ticket=... params and sets the session.
 * After that, Clerk redirects to actionCompleteRedirectUrl (the app root).
 */
import { AuthenticateWithRedirectCallback } from '@clerk/react';

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
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
