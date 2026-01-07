import { createContext, useContext, useEffect, ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';

interface AndroidSafeAreaContextType {
  bottomInset: number;
}

const AndroidSafeAreaContext = createContext<AndroidSafeAreaContextType>({ bottomInset: 0 });

export const useAndroidSafeArea = () => useContext(AndroidSafeAreaContext);

export const AndroidSafeAreaProvider = ({ children }: { children: ReactNode }) => {
  const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  useEffect(() => {
    if (!isNativeAndroid) return;

    const updateSafeArea = async () => {
      try {
        // Dynamic import to avoid loading on non-Android platforms
        const { SafeArea } = await import('capacitor-plugin-safe-area');
        const insets = await SafeArea.getSafeAreaInsets();
        
        // Clamp bottom inset to 0-24px to prevent excessive padding
        const clampedInset = Math.min(Math.max(insets.insets.bottom, 0), 24);
        
        document.documentElement.style.setProperty(
          '--android-bottom-inset',
          `${clampedInset}px`
        );
      } catch (error) {
        console.warn('Failed to get Android safe area insets:', error);
        // Fallback to 0
        document.documentElement.style.setProperty('--android-bottom-inset', '0px');
      }
    };

    updateSafeArea();

    // Listen for orientation changes to recalculate
    const handleResize = () => {
      updateSafeArea();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [isNativeAndroid]);

  return (
    <AndroidSafeAreaContext.Provider value={{ bottomInset: 0 }}>
      {children}
    </AndroidSafeAreaContext.Provider>
  );
};
