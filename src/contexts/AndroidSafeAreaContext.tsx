import { createContext, useContext, useEffect, ReactNode, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import type { InsetsData } from '@/plugins/androidInsets';

interface AndroidSafeAreaContextType {
  bottomInset: number;
  imeInset: number;
  navMode: string;
  fallbackUsed: boolean;
}

const AndroidSafeAreaContext = createContext<AndroidSafeAreaContextType>({
  bottomInset: 0,
  imeInset: 0,
  navMode: 'unknown',
  fallbackUsed: false,
});

export const useAndroidSafeArea = () => useContext(AndroidSafeAreaContext);

/**
 * Fallback inset when native plugin is truly unavailable.
 * Only used for Android web fallback or plugin failure.
 */
const FALLBACK_INSET = 24;

/**
 * Nav bar height constant for layout calculations.
 */
const NAV_HEIGHT = 56;

/**
 * Robust Android platform detection using Capacitor APIs.
 */
const detectAndroidPlatform = (): { isAndroid: boolean; isNative: boolean } => {
  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();
  
  // Primary: Use Capacitor's platform detection
  if (platform === 'android') {
    return { isAndroid: true, isNative };
  }
  
  // Fallback for web: Check user agent
  if (!isNative && typeof navigator !== 'undefined' && navigator.userAgent) {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.indexOf('android') !== -1) {
      return { isAndroid: true, isNative: false };
    }
  }
  
  return { isAndroid: false, isNative: false };
};

/**
 * Log inset changes with detailed debugging info.
 */
const logInsetChange = (
  source: string,
  data: {
    platform: string;
    systemBarsBottom: number;
    systemGesturesBottom: number;
    imeBottom: number;
    computedSafeBottom: number;
    navMode: string;
    reason: string;
    fallbackUsed: boolean;
  }
) => {
  console.log(`[AndroidSafeArea][${source}]`, data);
};

export const AndroidSafeAreaProvider = ({ children }: { children: ReactNode }) => {
  const [bottomInset, setBottomInset] = useState(0);
  const [imeInset, setImeInset] = useState(0);
  const [navMode, setNavMode] = useState<string>('unknown');
  const [fallbackUsed, setFallbackUsed] = useState(false);

  const { isAndroid, isNative: isNativeAndroid } = detectAndroidPlatform();

  /**
   * Apply insets to CSS variables and state.
   * This is the SINGLE place where --safe-bottom is set for Android.
   */
  const applyInsets = useCallback((data: InsetsData, source: string) => {
    // Compute bottomNavInset as max(systemBars, systemGestures)
    // This handles both gesture nav and 3-button nav correctly
    const systemBarsBottom = data.systemBarsBottom ?? data.bottom ?? 0;
    const systemGesturesBottom = data.systemGesturesBottom ?? 0;
    const computedBottom = Math.max(systemBarsBottom, systemGesturesBottom);
    
    // Keep IME inset separate - never mix with nav inset
    const ime = data.imeBottom ?? 0;
    const mode = data.navMode || 'unknown';
    const reason = data.reason || source;
    
    // Determine if we need to use fallback
    // Only use fallback if native returns 0 AND we're in a situation where it shouldn't be 0
    // For gesture nav, 0 is valid; for 3-button nav, we expect some inset
    const useFallback = false; // Native plugin is source of truth - trust its values
    const finalBottom = computedBottom;

    setBottomInset(finalBottom);
    setImeInset(ime);
    setNavMode(mode);
    setFallbackUsed(useFallback);

    // Set the SINGLE CSS variable for Android safe area
    // This is the ONLY place --safe-bottom is set for Android
    document.documentElement.style.setProperty('--safe-bottom', `${finalBottom}px`);
    
    // Also set nav height as CSS variable for consistency
    document.documentElement.style.setProperty('--nav-height', `${NAV_HEIGHT}px`);

    logInsetChange(source, {
      platform: 'android-native',
      systemBarsBottom,
      systemGesturesBottom,
      imeBottom: ime,
      computedSafeBottom: finalBottom,
      navMode: mode,
      reason,
      fallbackUsed: useFallback,
    });
  }, []);

  /**
   * Apply fallback values for web or plugin failure.
   */
  const applyFallback = useCallback((reason: string) => {
    setBottomInset(FALLBACK_INSET);
    setImeInset(0);
    setNavMode(`${reason}-fallback`);
    setFallbackUsed(true);

    document.documentElement.style.setProperty('--safe-bottom', `${FALLBACK_INSET}px`);
    document.documentElement.style.setProperty('--nav-height', `${NAV_HEIGHT}px`);

    logInsetChange(reason, {
      platform: 'android-web',
      systemBarsBottom: 0,
      systemGesturesBottom: 0,
      imeBottom: 0,
      computedSafeBottom: FALLBACK_INSET,
      navMode: 'fallback',
      reason,
      fallbackUsed: true,
    });
  }, []);

  useEffect(() => {
    // Non-Android platforms: set CSS vars to 0 to not interfere
    if (!isAndroid) {
      document.documentElement.style.setProperty('--safe-bottom', '0px');
      document.documentElement.style.setProperty('--nav-height', `${NAV_HEIGHT}px`);
      return;
    }

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    /**
     * Set Android navigation bar color to match app theme.
     */
    const setAndroidNavBarColor = async () => {
      if (!isNativeAndroid) return;
      
      try {
        await StatusBar.setBackgroundColor({ color: '#3d6b52' });
        await StatusBar.setStyle({ style: Style.Dark });
        console.log('[AndroidSafeArea] Navigation bar color set to #3d6b52');
      } catch (error) {
        console.warn('[AndroidSafeArea] Failed to set navigation bar color:', error);
      }
    };

    const setupInsets = async () => {
      if (isNativeAndroid) {
        try {
          // Import and use native AndroidInsets plugin
          const AndroidInsets = (await import('@/plugins/androidInsets')).default;

          // Get initial insets
          const insets = await AndroidInsets.getInsets();
          applyInsets({ ...insets, reason: 'initial' }, 'initial');

          // Listen for inset changes (nav mode switch, rotation, resume, etc.)
          listenerHandle = await AndroidInsets.addListener('insetsChanged', (data) => {
            applyInsets(data, 'insetsChanged');
          });

          console.log('[AndroidSafeArea] Native plugin initialized - listening for inset changes');
        } catch (error) {
          // Plugin failed - use fallback
          console.warn('[AndroidSafeArea] Plugin error, using fallback:', error);
          applyFallback('error');
        }
      } else {
        // Android Web - use fallback
        applyFallback('web');
      }
    };

    setupInsets();
    
    // Set navigation bar color on native Android
    if (isNativeAndroid) {
      setAndroidNavBarColor();
    }

    return () => {
      if (listenerHandle) listenerHandle.remove();
    };
  }, [isAndroid, isNativeAndroid, applyInsets, applyFallback]);

  return (
    <AndroidSafeAreaContext.Provider value={{ bottomInset, imeInset, navMode, fallbackUsed }}>
      {children}
    </AndroidSafeAreaContext.Provider>
  );
};
