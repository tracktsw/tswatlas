import { useMemo } from 'react';
import { Capacitor } from '@capacitor/core';

export const usePlatform = () => {
  return useMemo(() => ({
    isAndroid: Capacitor.getPlatform() === 'android',
    isIOS: Capacitor.getPlatform() === 'ios',
    isWeb: Capacitor.getPlatform() === 'web',
    isNative: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform(),
  }), []);
};

// Static helper for use outside of React components
export const getPlatformInfo = () => ({
  isAndroid: Capacitor.getPlatform() === 'android',
  isIOS: Capacitor.getPlatform() === 'ios',
  isWeb: Capacitor.getPlatform() === 'web',
  isNative: Capacitor.isNativePlatform(),
  platform: Capacitor.getPlatform(),
});
