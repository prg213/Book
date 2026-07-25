package com.mystorybook.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Remove the "wv" (WebView) identifier from the user agent string.
        // Google blocks OAuth in standard WebViews based on this flag.
        // Removing it makes the WebView appear as a normal Chrome browser,
        // allowing Google OAuth to proceed in-page without needing a Custom Tab.
        WebSettings settings = getBridge().getWebView().getSettings();
        String ua = settings.getUserAgentString();
        // "wv" appears as "; wv)" in the UA — strip it
        String patchedUa = ua
            .replace("; wv)", ")")
            .replace(" wv ", " ");
        settings.setUserAgentString(patchedUa);
    }
}
