import { createContext, useContext, useEffect, ReactNode, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import type { InsetsData } from '@/plugins/androidInsets';

interface AndroidSafeAreaContextType {
  bottomInset: number;
  navMode: string;
  fallbackUsed: boolean;
}

const AndroidSafeAreaContext = createContext<AndroidSafeAreaContextType>({
  bottomInset: 0,
  navMode: 'unknown',
  fallbackUsed: false,
});

export const useAndroidSafeArea = () => useContext(AndroidSafeAreaContext);

/**
 * Fallback inset when native plugin unavailable or returns 0.
 * 24px is a reasonable default for most Android devices.
 */
const FALLBACK_INSET = 24;

/**
 * Robust Android platform detection that won't break with minification.
 * Uses Capacitor's API as primary source, with user agent as fallback for web.
 */
const detectAndroidPlatform = (): { isAndroid: boolean; isNative: boolean } => {
  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();
  
  // Primary: Use Capacitor's platform detection (minification-safe string comparison)
  if (platform === 'android') {
    return { isAndroid: true, isNative };
  }
  
  // Fallback for web: Check user agent (only when not in Capacitor native)
  if (!isNative && typeof navigator !== 'undefined' && navigator.userAgent) {
    const ua = navigator.userAgent.toLowerCase();
    // Use indexOf for robustness - string method won't be affected by minification
    if (ua.indexOf('android') !== -1) {
      return { isAndroid: true, isNative: false };
    }
  }
  
  return { isAndroid: false, isNative: false };
};

export const AndroidSafeAreaProvider = ({ children }: { children: ReactNode }) => {
  const [bottomInset, setBottomInset] = useState(0);
  const [navMode, setNavMode] = useState<string>('unknown');
  const [fallbackUsed, setFallbackUsed] = useState(false);

  const { isAndroid, isNative: isNativeAndroid } = detectAndroidPlatform();

  useEffect(() => {
    // Only apply Android-specific safe area handling
    if (!isAndroid) {
      // Not Android - set to 0 to not interfere with iOS
      document.documentElement.style.setProperty('--android-safe-bottom', '0px');
      return;
    }

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const applyInsets = (data: InsetsData, source: string) => {
      const rawBottom = data.bottom ?? 0;
      const mode = data.navMode || 'unknown';

      // Use fallback if native returns 0
      const useFallback = rawBottom === 0;
      const finalBottom = useFallback ? FALLBACK_INSET : rawBottom;

      setBottomInset(finalBottom);
      setNavMode(mode);
      setFallbackUsed(useFallback);

      // Set the Android-specific CSS variable
      document.documentElement.style.setProperty('--android-safe-bottom', `${finalBottom}px`);

      console.log(`[AndroidSafeArea][${source}]`, {
        platform: 'android-native',
        navMode: mode,
        rawBottom,
        appliedBottom: finalBottom,
        fallbackUsed: useFallback,
        cssVar: `--android-safe-bottom: ${finalBottom}px`,
      });
    };

    /**
     * Set Android navigation bar color to match the app background.
     * Uses the sage-deep color (#3d6b52) to match the app's theme.
     */
    const setAndroidNavBarColor = async () => {
      if (!isNativeAndroid) return;
      
      try {
        // Set navigation bar background to match app theme (sage-deep: #3d6b52)
        await StatusBar.setBackgroundColor({ color: '#3d6b52' });
        // Use light content (white icons) since background is dark
        await StatusBar.setStyle({ style: Style.Dark });
        console.log('[AndroidSafeArea] Navigation bar color set to #3d6b52');
      } catch (error) {
        console.warn('[AndroidSafeArea] Failed to set navigation bar color:', error);
      }
    };

    const setupInsets = async () => {
      if (isNativeAndroid) {
        try {
          // Use existing custom AndroidInsets plugin
          const AndroidInsets = (await import('@/plugins/androidInsets')).default;

          const insets = await AndroidInsets.getInsets();
          applyInsets(insets, 'initial');

          // Listen for inset changes
          listenerHandle = await AndroidInsets.addListener('insetsChanged', (data) => {
            applyInsets(data, 'insetsChanged');
          });

          console.log('[AndroidSafeArea] Native plugin initialized');
        } catch (error) {
          // Plugin failed - use fallback
          console.warn('[AndroidSafeArea] Plugin error, using fallback:', error);
          setBottomInset(FALLBACK_INSET);
          setFallbackUsed(true);
          setNavMode('error-fallback');
          document.documentElement.style.setProperty('--android-safe-bottom', `${FALLBACK_INSET}px`);
        }
      } else {
        // Android Web - use fallback
        setBottomInset(FALLBACK_INSET);
        setFallbackUsed(true);
        setNavMode('web-fallback');
        document.documentElement.style.setProperty('--android-safe-bottom', `${FALLBACK_INSET}px`);

        console.log('[AndroidSafeArea] Android web fallback applied:', FALLBACK_INSET);
      }
    };

    setupInsets();
    
    // Set Android navigation bar color on native Android
    if (isNativeAndroid) {
      setAndroidNavBarColor();
    }

    return () => {
      if (listenerHandle) listenerHandle.remove();
    };
  }, [isAndroid, isNativeAndroid]);

  return (
    <AndroidSafeAreaContext.Provider value={{ bottomInset, navMode, fallbackUsed }}>
      {children}
    </AndroidSafeAreaContext.Provider>
  );
};
