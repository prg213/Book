import type { CapacitorConfig } from '@capacitor/cli';

// ── IMPORTANT ────────────────────────────────────────────────────────────────
// After you publish the app on Replit, replace the URL below with your
// production URL (e.g. https://abc123.replit.app).
// Then push to GitHub — Actions will build a new APK automatically.
// ─────────────────────────────────────────────────────────────────────────────
const PRODUCTION_URL = 'https://REPLACE_WITH_YOUR_REPLIT_APP_URL.replit.app';

const config: CapacitorConfig = {
  appId: 'com.mystorybook.app',
  appName: 'MyStoryBook',
  webDir: 'dist/public',
  server: {
    url: PRODUCTION_URL,
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#1a0e08',
  },
};

export default config;
