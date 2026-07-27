import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

import App from './App';

import './index.css';

// On Android Capacitor, stop the status bar from overlaying the WebView so
// content starts below it naturally (env(safe-area-inset-top) is 0 there).
// iOS uses viewport-fit=cover + env(safe-area-inset-top) in CSS instead.
if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
  StatusBar.setOverlaysWebView({ overlay: false });
  StatusBar.setStyle({ style: Style.Dark }); // light icons on dark background
  StatusBar.setBackgroundColor({ color: '#1a0e08' });
}

createRoot(document.getElementById('root')!).render(<App />);
