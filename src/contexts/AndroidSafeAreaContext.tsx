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
   * Apply insets to state only - Android bottom-nav uses navigationBars.bottom via --nav-bottom-inset.
   * We do NOT use env(safe-area-*) on Android.
   */
  const applyInsets = useCallback((data: InsetsData, source: string) => {
    const systemBarsBottom = data.systemBarsBottom ?? data.bottom ?? 0;
    const systemGesturesBottom = data.systemGesturesBottom ?? 0;
    const computedBottom = Math.max(systemBarsBottom, systemGesturesBottom);
    const ime = data.imeBottom ?? 0;

    // What we actually need for BottomNav clipping: navigation bar inset only (no IME)
    const navBottom = data.navigationBarsBottom ?? 0;

    const mode = data.navMode || 'unknown';
    const reason = data.reason || source;

    setBottomInset(computedBottom);
    setImeInset(ime);
    setNavMode(mode);
    setFallbackUsed(false);

    // CSS vars:
    // - --nav-height: constant row height
    // - --nav-bottom-inset: navigationBars.bottom from WindowInsetsCompat
    document.documentElement.style.setProperty('--nav-height', `${NAV_HEIGHT}px`);
    document.documentElement.style.setProperty('--nav-bottom-inset', `${navBottom}px`);

    console.log(`[Insets] navigationBars.bottom=${navBottom}`);

    logInsetChange(source, {
      platform: 'android-native',
      systemBarsBottom,
      systemGesturesBottom,
      imeBottom: ime,
      computedSafeBottom: computedBottom,
      navMode: mode,
      reason,
      fallbackUsed: false,
    });
  }, []);

  /**
   * Apply fallback values for web or plugin failure.
   * We cannot reliably read navigationBars.bottom on plain web, so keep it 0.
   */
  const applyFallback = useCallback((reason: string) => {
    setBottomInset(FALLBACK_INSET);
    setImeInset(0);
    setNavMode(`${reason}-fallback`);
    setFallbackUsed(true);

    document.documentElement.style.setProperty('--nav-height', `${NAV_HEIGHT}px`);
    document.documentElement.style.setProperty('--nav-bottom-inset', '0px');

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
    // Non-Android platforms: ensure vars are 0 so we never affect iOS/web.
    if (!isAndroid) {
      document.documentElement.style.setProperty('--safe-bottom', '0px');
      document.documentElement.style.setProperty('--nav-bottom-inset', '0px');
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
