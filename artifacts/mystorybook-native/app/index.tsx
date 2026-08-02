import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useState, useRef, useCallback } from 'react';

const APP_URL = 'https://mystorybook.world';

// Clerk domain from the publishable key (magical-mako-58.clerk.accounts.dev)
const OAUTH_PATTERNS = [
  'accounts.google.com',
  'clerk.accounts.dev',   // catches ALL Clerk OAuth initiations including the redirect chain
  'appleid.apple.com',
];

// Chrome user-agent — strips the "wv" WebView marker
const CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

function isOAuthUrl(url: string): boolean {
  return OAUTH_PATTERNS.some((p) => url.includes(p));
}

export default function App() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const webviewRef = useRef<WebView>(null);
  // Prevent handling the same URL twice (redirect chains can fire multiple events)
  const handledRef = useRef<string | null>(null);

  const openOAuth = useCallback((authUrl: string) => {
    if (handledRef.current === authUrl) return;
    handledRef.current = authUrl;

    // Stop the WebView before it renders the OAuth page
    webviewRef.current?.stopLoading();

    WebBrowser.openAuthSessionAsync(authUrl, APP_URL)
      .then((result) => {
        handledRef.current = null;
        if (result.type === 'success' && result.url) {
          // Deliver the callback URL back into the WebView to complete sign-in
          webviewRef.current?.injectJavaScript(
            `window.location.href = ${JSON.stringify(result.url)};true;`
          );
        } else {
          // User cancelled — go back to the app home
          webviewRef.current?.injectJavaScript(
            `window.location.href = ${JSON.stringify(APP_URL)};true;`
          );
        }
      })
      .catch(() => {
        handledRef.current = null;
      });
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
        // onShouldStartLoadWithRequest catches direct navigations
        onShouldStartLoadWithRequest={(req) => {
          if (isOAuthUrl(req.url)) {
            openOAuth(req.url);
            return false;
          }
          return true;
        }}
        // onNavigationStateChange catches server-side redirects (302s) that
        // onShouldStartLoadWithRequest misses on Android
        onNavigationStateChange={(navState) => {
          if (isOAuthUrl(navState.url)) {
            openOAuth(navState.url);
          }
        }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
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
