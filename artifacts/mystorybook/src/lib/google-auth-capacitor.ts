/**
 * Opens Google OAuth in a Chrome Custom Tab (via @capacitor/browser).
 * This bypasses the WebView restriction Google imposed in 2021.
 *
 * Flow:
 *  1. Call Clerk's signIn.create() to get the Google OAuth URL (without navigating)
 *  2. Open that URL in a Chrome Custom Tab
 *  3. Google → Clerk → production /sso-callback → Clerk sets session cookie
 *  4. Custom Tab closes (user completes or cancels)
 *  5. Reload the WebView — Clerk picks up the session from the cookie
 */
import { Browser } from '@capacitor/browser';
import type { SignInResource } from '@clerk/types';

export async function signInWithGoogleCustomTab(signIn: SignInResource): Promise<void> {
  const origin = window.location.origin;

  // Ask Clerk for the Google OAuth URL — this does NOT navigate the WebView
  const attempt = await signIn.create({
    strategy: 'oauth_google',
    redirectUrl: `${origin}/sso-callback`,
    actionCompleteRedirectUrl: origin,
  } as any);

  const oauthUrl = (attempt as any).firstFactorVerification?.externalVerificationRedirectURL?.href;

  if (!oauthUrl) {
    throw new Error('Clerk did not return a Google OAuth URL. Check Clerk dashboard social provider settings.');
  }

  // Open in Chrome Custom Tab — Google allows this (not a WebView)
  await Browser.open({ url: oauthUrl, windowName: '_blank' });

  // Wait for the user to finish / close the tab
  await new Promise<void>((resolve) => {
    Browser.addListener('browserFinished', () => resolve());
  });

  // The session cookie is now set on the production domain.
  // Reload the WebView to let Clerk pick it up.
  window.location.reload();
}
