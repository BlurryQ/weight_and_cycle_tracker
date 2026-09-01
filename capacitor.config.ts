import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maskwearer.weighttracker',
  appName: 'Weight & Cycle Tracker',
  webDir: 'dist',
  backgroundColor: '#0e1013',
  android: {
    backgroundColor: '#0e1013',
    // Android 15 (targetSdk 35) forces edge-to-edge. 'force' makes Capacitor inset the WebView
    // by the system-bar margins so the bottom tab bar isn't hidden behind the nav / gesture bar.
    adjustMarginsForEdgeToEdge: 'force',
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#0e1013',
      showSpinner: false,
      launchAutoHide: true,
    },
  },
};

export default config;
