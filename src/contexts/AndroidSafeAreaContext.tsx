import { createContext, useContext, useEffect, ReactNode, useState } from 'react';
import { Capacitor } from '@capacitor/core';

interface AndroidSafeAreaContextType {
  bottomInset: number;
}

const AndroidSafeAreaContext = createContext<AndroidSafeAreaContextType>({ bottomInset: 0 });

export const useAndroidSafeArea = () => useContext(AndroidSafeAreaContext);

// Minimum fallback for gesture navigation (typically 48px on most devices)
const MIN_GESTURE_NAV_HEIGHT = 48;

export const AndroidSafeAreaProvider = ({ children }: { children: ReactNode }) => {
  const [bottomInset, setBottomInset] = useState(0);
  const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  useEffect(() => {
    if (!isNativeAndroid) return;

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const setupSafeArea = async () => {
      try {
        // Use StatusBar to prevent WebView from drawing behind system bars
        const { StatusBar } = await import('@capacitor/status-bar');
        await StatusBar.setOverlaysWebView({ overlay: false });
        
        const { SafeArea } = await import('capacitor-plugin-safe-area');
        
        // Ensure we're not in immersive mode
        await SafeArea.unsetImmersiveNavigationBar();
        
        // Get insets - use fallback if reported as 0 (common on real devices with gesture nav)
        const { insets } = await SafeArea.getSafeAreaInsets();
        // If inset is 0 but we're on Android, use minimum fallback for gesture nav
        const bottomValue = insets.bottom > 0 ? insets.bottom : MIN_GESTURE_NAV_HEIGHT;
        setBottomInset(bottomValue);
        
        document.documentElement.style.setProperty(
          '--android-bottom-inset',
          `${bottomValue}px`
        );

        // Listen for changes (rotation, keyboard, etc.)
        listenerHandle = await SafeArea.addListener('safeAreaChanged', ({ insets }) => {
          const newBottom = insets.bottom > 0 ? insets.bottom : MIN_GESTURE_NAV_HEIGHT;
          setBottomInset(newBottom);
          document.documentElement.style.setProperty(
            '--android-bottom-inset',
            `${newBottom}px`
          );
        });

      } catch (error) {
        console.warn('Failed to setup Android safe area:', error);
        // Use fallback on error
        document.documentElement.style.setProperty('--android-bottom-inset', `${MIN_GESTURE_NAV_HEIGHT}px`);
      }
    };

    setupSafeArea();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [isNativeAndroid]);

  return (
    <AndroidSafeAreaContext.Provider value={{ bottomInset }}>
      {children}
    </AndroidSafeAreaContext.Provider>
  );
};
