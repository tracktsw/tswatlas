import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.tracktsw.atlas',
  appName: 'TSW Atlas',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    // Disable edge-to-edge margin adjustments - let WebView handle layout
    adjustMarginsForEdgeToEdge: 'never'
  }
};

export default config;
