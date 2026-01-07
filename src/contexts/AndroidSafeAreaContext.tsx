import { createContext, useContext, useEffect, ReactNode, useState } from 'react';
import { Capacitor } from '@capacitor/core';

interface AndroidSafeAreaContextType {
  bottomInset: number;
}

const AndroidSafeAreaContext = createContext<AndroidSafeAreaContextType>({ bottomInset: 0 });

export const useAndroidSafeArea = () => useContext(AndroidSafeAreaContext);

// Fallback minimum if native plugin fails (covers most 3-button nav bars)
const FALLBACK_MIN_INSET = 72;

const clampPx = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);

export const AndroidSafeAreaProvider = ({ children }: { children: ReactNode }) => {
  const [bottomInset, setBottomInset] = useState(0);
  const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  useEffect(() => {
    if (!isNativeAndroid) return;

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const applyBottomInset = (value: number) => {
      const next = clampPx(value);
      setBottomInset(next);
      document.documentElement.style.setProperty('--app-safe-bottom', `${next}px`);
    };

    const setupInsets = async () => {
      try {
        // Try our custom native plugin first (real WindowInsets)
        const AndroidInsets = (await import('@/plugins/androidInsets')).default;
        
        // Get initial insets
        const insets = await AndroidInsets.getInsets();
        const bottom = clampPx(insets.bottom);
        
        // If native returns 0, use fallback (some devices/modes report 0 incorrectly)
        applyBottomInset(bottom > 0 ? bottom : FALLBACK_MIN_INSET);

        // Listen for inset changes (rotation, nav mode toggle, etc.)
        listenerHandle = await AndroidInsets.addListener('insetsChanged', (data) => {
          const newBottom = clampPx(data.bottom);
          applyBottomInset(newBottom > 0 ? newBottom : FALLBACK_MIN_INSET);
        });

      } catch (nativeError) {
        console.warn('[AndroidSafeArea] Native plugin not available, trying fallback:', nativeError);
        
        // Fallback: try capacitor-plugin-safe-area
        try {
          const { SafeArea } = await import('capacitor-plugin-safe-area');
          await SafeArea.unsetImmersiveNavigationBar();
          
          const { insets } = await SafeArea.getSafeAreaInsets();
          const pluginBottom = clampPx(insets.bottom);
          
          applyBottomInset(pluginBottom > 0 ? pluginBottom : FALLBACK_MIN_INSET);

          // Listen for changes
          listenerHandle = await SafeArea.addListener('safeAreaChanged', ({ insets: newInsets }) => {
            const newBottom = clampPx(newInsets.bottom);
            applyBottomInset(newBottom > 0 ? newBottom : FALLBACK_MIN_INSET);
          });

        } catch (fallbackError) {
          console.warn('[AndroidSafeArea] Fallback plugin failed, using minimum:', fallbackError);
          applyBottomInset(FALLBACK_MIN_INSET);
        }
      }
    };

    setupInsets();

    return () => {
      if (listenerHandle) listenerHandle.remove();
    };
  }, [isNativeAndroid]);

  return (
    <AndroidSafeAreaContext.Provider value={{ bottomInset }}>
      {children}
    </AndroidSafeAreaContext.Provider>
  );
};
