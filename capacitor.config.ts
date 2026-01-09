import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.swat.tswatlas',
  appName: 'tswatlas',
  webDir: 'dist',
  plugins: {
    Camera: {
      // Ensure compatibility with latest Android versions including Pixel 10 XL
      androidxActivityVersion: '1.8.0',
      androidxExifInterfaceVersion: '1.3.6',
    },
  },
  android: {
    // Allow mixed content if needed
    allowMixedContent: true,
    // Capture back button
    captureInput: true,
    // WebView debugging (can remove in production)
    webContentsDebuggingEnabled: true,
  },
};

export default config;