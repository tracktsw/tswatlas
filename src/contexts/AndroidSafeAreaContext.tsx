import { createContext, useContext, useEffect, ReactNode, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import type { InsetsData } from '@/plugins/androidInsets';

interface AndroidSafeAreaContextType {
  bottomInset: number;
  imeInset: number;
  navMode: string;
}

const AndroidSafeAreaContext = createContext<AndroidSafeAreaContextType>({
  bottomInset: 0,
  imeInset: 0,
  navMode: 'unknown',
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

  const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  useEffect(() => {
    if (!isNativeAndroid) return;

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const applyInsets = (data: InsetsData, source: string) => {
      const rawBottom = clampPx(data.bottom);
      const rawIme = clampPx(data.imeBottom);
      const mode = data.navMode || 'unknown';

      // Determine if we need fallback
      const useFallback = rawBottom === 0;
      const finalBottom = useFallback ? FALLBACK_INSET : rawBottom;

      setBottomInset(finalBottom);
      setImeInset(rawIme);
      setNavMode(mode);
      setFallbackUsed(useFallback);

      // Set the single CSS variable for bottom safe area
      document.documentElement.style.setProperty('--safe-bottom', `${finalBottom}px`);

      // Log for verification (required)
      console.log('[AndroidSafeArea]', {
        source,
        platform: 'android',
        navMode: mode,
        nativeBottomNavInsetPx: rawBottom,
        imeInsetPx: rawIme,
        appliedBottomPx: finalBottom,
        fallbackUsed: useFallback,
      });
    };

    const setupInsets = async () => {
      try {
        // Dynamically import to avoid issues when not on Android
        const AndroidInsets = (await import('@/plugins/androidInsets')).default;

        // Get initial insets
        const insets = await AndroidInsets.getInsets();
        applyInsets(insets, 'initial');

        // Listen for inset changes (rotation, nav mode toggle, resume, etc.)
        listenerHandle = await AndroidInsets.addListener('insetsChanged', (data) => {
          applyInsets(data, 'insetsChanged');
        });
      } catch (error) {
        // Native plugin not available - use fallback
        console.warn('[AndroidSafeArea] Native plugin not available, using fallback:', error);
        setBottomInset(FALLBACK_INSET);
        setFallbackUsed(true);
        setNavMode('unknown');
        document.documentElement.style.setProperty('--safe-bottom', `${FALLBACK_INSET}px`);

        console.log('[AndroidSafeArea]', {
          source: 'fallback',
          platform: 'android',
          navMode: 'unknown',
          nativeBottomNavInsetPx: 0,
          imeInsetPx: 0,
          appliedBottomPx: FALLBACK_INSET,
          fallbackUsed: true,
        });
      }
    };

    setupInsets();

    return () => {
      if (listenerHandle) listenerHandle.remove();
    };
  }, [isNativeAndroid]);

  return (
    <AndroidSafeAreaContext.Provider value={{ bottomInset, imeInset, navMode }}>
      {children}
    </AndroidSafeAreaContext.Provider>
  );
};
