import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.tracktsw.atlas',
  appName: 'TSW Atlas',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    adjustMarginsForEdgeToEdge: 'enable'
  }
};

export default config;
