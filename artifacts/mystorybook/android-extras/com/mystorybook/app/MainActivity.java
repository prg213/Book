package com.mystorybook.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register custom plugins BEFORE super.onCreate() — Capacitor requirement.
        registerPlugin(AudioRecorderPlugin.class);
        super.onCreate(savedInstanceState);

        // Remove the "wv" (WebView) identifier from the user agent string.
        // Google blocks OAuth in standard WebViews based on this flag.
        WebSettings settings = getBridge().getWebView().getSettings();
        String ua = settings.getUserAgentString();
        String patchedUa = ua
            .replace("; wv)", ")")
            .replace(" wv ", " ");
        settings.setUserAgentString(patchedUa);
    }
}
