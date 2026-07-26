package com.mystorybook.app;

import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Remove the "wv" (WebView) identifier from the user agent string.
        // Google blocks OAuth in standard WebViews based on this flag.
        WebSettings settings = getBridge().getWebView().getSettings();
        String ua = settings.getUserAgentString();
        String patchedUa = ua
            .replace("; wv)", ")")
            .replace(" wv ", " ");
        settings.setUserAgentString(patchedUa);

        // Grant WebView permission requests for microphone (and camera if needed).
        // Without this override, getUserMedia() always fails in the Capacitor WebView
        // even when the Android app has RECORD_AUDIO permission granted at the OS level.
        // BridgeWebChromeClient is extended so all other Capacitor WebChromeClient
        // behaviour (file chooser, console messages, etc.) continues to work.
        getBridge().getWebView().setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.grant(request.getResources());
            }
        });
    }
}
