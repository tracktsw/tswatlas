import { createContext, useContext, useEffect, ReactNode, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import type { InsetsData } from '@/plugins/androidInsets';

interface AndroidSafeAreaContextType {
  bottomInset: number;
  imeInset: number;
  navMode: string;
  fallbackUsed: boolean;
  rawInsets: {
    systemBarsBottom: number;
    systemGesturesBottom: number;
    navigationBarsBottom: number;
    imeBottom: number;
    computedBottom: number;
  };
}

const AndroidSafeAreaContext = createContext<AndroidSafeAreaContextType>({
  bottomInset: 0,
  imeInset: 0,
  navMode: 'unknown',
  fallbackUsed: false,
  rawInsets: {
    systemBarsBottom: 0,
    systemGesturesBottom: 0,
    navigationBarsBottom: 0,
    imeBottom: 0,
    computedBottom: 0,
  },
});

export const useAndroidSafeArea = () => useContext(AndroidSafeAreaContext);

/**
 * Fallback inset when native plugin unavailable or returns null/0.
 * 48px covers typical gesture-nav (24-32dp) and 3-button nav (48dp) on most devices.
 * ONLY used as last resort when native returns invalid data.
 */
const FALLBACK_INSET = 48;

const clampPx = (n: number | undefined | null): number =>
  n != null && Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;

export const AndroidSafeAreaProvider = ({ children }: { children: ReactNode }) => {
  const [bottomInset, setBottomInset] = useState(0);
  const [imeInset, setImeInset] = useState(0);
  const [navMode, setNavMode] = useState<string>('unknown');
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [rawInsets, setRawInsets] = useState({
    systemBarsBottom: 0,
    systemGesturesBottom: 0,
    navigationBarsBottom: 0,
    imeBottom: 0,
    computedBottom: 0,
  });

  const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  useEffect(() => {
    if (!isNativeAndroid) return;

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const applyInsets = (data: InsetsData, source: string) => {
      // Extract all raw values for debugging
      const systemBarsBottom = clampPx(data.systemBarsBottom);
      const systemGesturesBottom = clampPx(data.systemGesturesBottom);
      const navigationBarsBottom = clampPx(data.navigationBarsBottom);
      const rawIme = clampPx(data.imeBottom);
      const rawBottom = clampPx(data.bottom); // This should be max(systemBars, systemGestures) from native
      const mode = data.navMode || 'unknown';

      // Determine if we need fallback - only if native returns 0 or invalid
      const useFallback = rawBottom === 0;
      const finalBottom = useFallback ? FALLBACK_INSET : rawBottom;

      // Update state
      setBottomInset(finalBottom);
      setImeInset(rawIme);
      setNavMode(mode);
      setFallbackUsed(useFallback);
      setRawInsets({
        systemBarsBottom,
        systemGesturesBottom,
        navigationBarsBottom,
        imeBottom: rawIme,
        computedBottom: rawBottom,
      });

      // Set the SINGLE CSS variable for bottom safe area
      // This is the ONLY place --safe-bottom is set for Android
      document.documentElement.style.setProperty('--safe-bottom', `${finalBottom}px`);

      // Comprehensive logging for device verification
      console.log(`[AndroidSafeArea][${source}]`, {
        platform: 'android',
        navMode: mode,
        // Raw inset components from native
        'systemBars.bottom': systemBarsBottom,
        'systemGestures.bottom': systemGesturesBottom,
        'navigationBars.bottom': navigationBarsBottom,
        'ime.bottom': rawIme,
        // Computed values
        computedBottomNavInsetPx: rawBottom,
        appliedBottomPx: finalBottom,
        fallbackUsed: useFallback,
        // CSS variable verification
        cssVarSet: `--safe-bottom: ${finalBottom}px`,
      });
    };

    const setupInsets = async () => {
      try {
        // Dynamically import to avoid issues when not on Android
        const AndroidInsets = (await import('@/plugins/androidInsets')).default;

        console.log('[AndroidSafeArea] Native plugin loading...');

        // Get initial insets
        const insets = await AndroidInsets.getInsets();
        applyInsets(insets, 'initial');

        // Listen for inset changes (rotation, nav mode toggle, resume, etc.)
        listenerHandle = await AndroidInsets.addListener('insetsChanged', (data) => {
          applyInsets(data, 'insetsChanged');
        });

        console.log('[AndroidSafeArea] Native plugin initialized successfully');
      } catch (error) {
        // Native plugin not available - use fallback
        console.warn('[AndroidSafeArea] Native plugin not available, using fallback:', error);
        setBottomInset(FALLBACK_INSET);
        setFallbackUsed(true);
        setNavMode('unknown');
        setRawInsets({
          systemBarsBottom: 0,
          systemGesturesBottom: 0,
          navigationBarsBottom: 0,
          imeBottom: 0,
          computedBottom: 0,
        });
        document.documentElement.style.setProperty('--safe-bottom', `${FALLBACK_INSET}px`);

        console.log('[AndroidSafeArea][fallback]', {
          platform: 'android',
          navMode: 'unknown',
          'systemBars.bottom': 0,
          'systemGestures.bottom': 0,
          'navigationBars.bottom': 0,
          'ime.bottom': 0,
          computedBottomNavInsetPx: 0,
          appliedBottomPx: FALLBACK_INSET,
          fallbackUsed: true,
          cssVarSet: `--safe-bottom: ${FALLBACK_INSET}px`,
          error: String(error),
        });
      }
    };

    setupInsets();

    return () => {
      if (listenerHandle) listenerHandle.remove();
    };
  }, [isNativeAndroid]);

  return (
    <AndroidSafeAreaContext.Provider value={{ bottomInset, imeInset, navMode, fallbackUsed, rawInsets }}>
      {children}
    </AndroidSafeAreaContext.Provider>
  );
};
