import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useState, useRef, useCallback } from 'react';

const APP_URL = 'https://mystorybook.world';

// Only intercept when the WebView is actually about to open an OAuth provider.
// DO NOT intercept clerk.accounts.dev — the Clerk sign-in UI must load inside
// the WebView. We only need to lift out the final provider redirect.
const OAUTH_PATTERNS = [
  'accounts.google.com',
  'appleid.apple.com',
];

// Spoof a desktop Chrome UA — removes the "wv" WebView marker Google checks for
const CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

function isOAuthUrl(url: string): boolean {
  return OAUTH_PATTERNS.some((p) => url.includes(p));
}

export default function App() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const webviewRef = useRef<WebView>(null);
  // Guard against the same URL being handled twice in a rapid redirect chain
  const handledRef = useRef<string | null>(null);

  const openOAuth = useCallback(async (authUrl: string) => {
    if (handledRef.current === authUrl) return;
    handledRef.current = authUrl;

    // Stop the WebView before it renders the OAuth page (Google blocks WebViews)
    webviewRef.current?.stopLoading();
    // Make sure the spinner doesn't stay forever if onLoadEnd never fires
    setLoading(false);

    try {
      // openBrowserAsync opens a Chrome Custom Tab inside the app.
      // The user completes Google sign-in there; Chrome/WebView share the same
      // Android cookie store, so the Clerk session cookie is available to the
      // WebView as soon as the tab is dismissed.
      await WebBrowser.openBrowserAsync(authUrl, {
        toolbarColor: '#7C3AED',
        showTitle: true,
        enableBarCollapsing: true,
      });
    } catch (_) {
      // If the browser failed to open, fall through and reload anyway
    }

    handledRef.current = null;

    // After the Chrome Tab is dismissed, navigate the WebView back to the app.
    // The shared cookie store means the user will be signed in automatically.
    setTimeout(() => {
      webviewRef.current?.injectJavaScript(
        `window.location.href = ${JSON.stringify(APP_URL)};true;`
      );
    }, 300);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      )}
      <WebView
        ref={webviewRef}
        source={{ uri: APP_URL }}
        style={styles.webview}
        userAgent={CHROME_UA}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        // onShouldStartLoadWithRequest catches direct link clicks and JS-initiated
        // navigations (fires before the request leaves the WebView)
        onShouldStartLoadWithRequest={(req) => {
          if (isOAuthUrl(req.url)) {
            openOAuth(req.url);
            return false; // block the WebView from loading it
          }
          return true;
        }}
        // onNavigationStateChange catches server-side 302 redirects that
        // onShouldStartLoadWithRequest misses on Android
        onNavigationStateChange={(navState) => {
          if (isOAuthUrl(navState.url)) {
            openOAuth(navState.url);
          }
        }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => setLoading(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F5F0',
  },
  webview: {
    flex: 1,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F5F0',
    zIndex: 10,
  },
});
