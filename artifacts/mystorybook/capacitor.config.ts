import type { CapacitorConfig } from '@capacitor/cli';

// ── IMPORTANT ────────────────────────────────────────────────────────────────
// After you publish the app on Replit, replace the URL below with your
// production URL (e.g. https://abc123.replit.app).
// Then push to GitHub — Actions will build a new APK automatically.
// ─────────────────────────────────────────────────────────────────────────────
const PRODUCTION_URL = 'https://grok-canvas-copy.replit.app';

const config: CapacitorConfig = {
  appId: 'com.mystorybook.app',
  appName: 'MyStoryBook',
  webDir: 'dist/public',
  server: {
    url: PRODUCTION_URL,
    cleartext: false,
    // Allow the WebView to navigate to OAuth and callback domains.
    // Without this, window.location.href to an external domain is silently blocked.
    allowNavigation: [
      'grateful-terrier-54.accounts.dev', // Clerk Account Portal
      'accounts.google.com',              // Google sign-in page
      '*.google.com',                     // Google OAuth redirects
      'grok-canvas-copy.replit.app',      // our app (callback target)
    ],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#1a0e08',
  },
};

export default config;
