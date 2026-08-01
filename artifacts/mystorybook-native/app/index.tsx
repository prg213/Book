import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useState, useRef, useCallback } from 'react';

const APP_URL = 'https://mystorybook.world';

// Chrome user-agent — no "wv" marker
const CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

// URLs that must open in Chrome Custom Tab (blocked inside WebView)
function needsCustomTab(url: string): boolean {
  return (
    url.includes('accounts.google.com') ||
    url.includes('accounts.youtube.com') ||
    url.includes('appleid.apple.com')
  );
}

export default function App() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const webviewRef = useRef<WebView>(null);

  const handleShouldStartLoad = useCallback(
    (request: WebViewNavigation): boolean => {
      if (needsCustomTab(request.url)) {
        // Open OAuth in Chrome Custom Tab; watch for redirect back to our domain
        WebBrowser.openAuthSessionAsync(request.url, APP_URL).then((result) => {
          if (result.type === 'success' && result.url) {
            // Load the callback URL inside the WebView to complete sign-in
            webviewRef.current?.injectJavaScript(
              `window.location.href = ${JSON.stringify(result.url)};true;`
            );
          }
        });
        return false; // Prevent WebView from loading it
      }
      return true;
    },
    []
  );

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
        onShouldStartLoadWithRequest={handleShouldStartLoad}
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
