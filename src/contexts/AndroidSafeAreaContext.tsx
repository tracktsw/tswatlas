import { createContext, useContext, useEffect, ReactNode, useState } from 'react';
import { Capacitor } from '@capacitor/core';

interface AndroidSafeAreaContextType {
  bottomInset: number;
}

const AndroidSafeAreaContext = createContext<AndroidSafeAreaContextType>({ bottomInset: 0 });

export const useAndroidSafeArea = () => useContext(AndroidSafeAreaContext);

// Minimum fallback for gesture navigation (typically ~48px on many devices)
const MIN_GESTURE_NAV_HEIGHT = 48;

const clampPx = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);

const getVisualViewportBottomOcclusion = () => {
  // Estimates how much of the bottom is "taken" by system UI / overlays.
  // On many real Android devices with gesture nav, this is non-zero even when
  // safe-area env vars and plugin insets report 0.
  const vv = window.visualViewport;
  if (!vv) return 0;

  // innerHeight includes the area behind overlays; visualViewport.height is the
  // visible area. offsetTop matters for keyboards / browser UI.
  const occlusion = window.innerHeight - vv.height - vv.offsetTop;
  return clampPx(occlusion);
};

export const AndroidSafeAreaProvider = ({ children }: { children: ReactNode }) => {
  const [bottomInset, setBottomInset] = useState(0);
  const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  useEffect(() => {
    if (!isNativeAndroid) return;

    let listenerHandle: { remove: () => Promise<void> } | null = null;
    let detachViewportListeners: (() => void) | null = null;

    const applyBottomInset = (candidate: number) => {
      const next = clampPx(Math.max(candidate, MIN_GESTURE_NAV_HEIGHT));
      setBottomInset(next);
      document.documentElement.style.setProperty('--android-bottom-inset', `${next}px`);
    };

    const setupSafeArea = async () => {
      try {
        // StatusBar overlay control helps on some devices, but nav-bar/gesture areas
        // are inconsistent; we combine multiple signals below.
        const { StatusBar } = await import('@capacitor/status-bar');
        await StatusBar.setOverlaysWebView({ overlay: false });

        const { SafeArea } = await import('capacitor-plugin-safe-area');

        // Ensure we're not in immersive mode
        await SafeArea.unsetImmersiveNavigationBar();

        const computeAndApply = async () => {
          const viewportOcclusion = getVisualViewportBottomOcclusion();
          let pluginBottom = 0;

          try {
            const { insets } = await SafeArea.getSafeAreaInsets();
            pluginBottom = clampPx(insets.bottom);
          } catch {
            // ignore; we'll rely on viewport occlusion + min fallback
          }

          applyBottomInset(Math.max(pluginBottom, viewportOcclusion));
        };

        // Initial
        await computeAndApply();

        // Listen for plugin changes (rotation, etc.)
        listenerHandle = await SafeArea.addListener('safeAreaChanged', ({ insets }) => {
          const viewportOcclusion = getVisualViewportBottomOcclusion();
          const pluginBottom = clampPx(insets.bottom);
          applyBottomInset(Math.max(pluginBottom, viewportOcclusion));
        });

        // VisualViewport listeners (device-specific gesture/nav overlays + dynamic changes)
        const vv = window.visualViewport;
        if (vv) {
          const onVvChange = () => {
            const viewportOcclusion = getVisualViewportBottomOcclusion();
            applyBottomInset(viewportOcclusion);
          };

          vv.addEventListener('resize', onVvChange);
          vv.addEventListener('scroll', onVvChange);
          window.addEventListener('resize', onVvChange);

          detachViewportListeners = () => {
            vv.removeEventListener('resize', onVvChange);
            vv.removeEventListener('scroll', onVvChange);
            window.removeEventListener('resize', onVvChange);
          };
        }
      } catch (error) {
        console.warn('Failed to setup Android safe area:', error);
        // Last-resort fallback
        applyBottomInset(MIN_GESTURE_NAV_HEIGHT);
      }
    };

    setupSafeArea();

    return () => {
      if (listenerHandle) listenerHandle.remove();
      if (detachViewportListeners) detachViewportListeners();
    };
  }, [isNativeAndroid]);

  return (
    <AndroidSafeAreaContext.Provider value={{ bottomInset }}>
      {children}
    </AndroidSafeAreaContext.Provider>
  );
};

