import { createContext, useContext, useEffect, ReactNode, useState } from 'react';
import { Capacitor } from '@capacitor/core';

interface AndroidSafeAreaContextType {
  bottomInset: number;
}

const AndroidSafeAreaContext = createContext<AndroidSafeAreaContextType>({ bottomInset: 0 });

export const useAndroidSafeArea = () => useContext(AndroidSafeAreaContext);

// Fallback inset used ONLY if native plugin is unavailable.
// IMPORTANT: Do not force a minimum inset when the platform reports 0,
// otherwise we double-apply spacing and the BottomNav appears to "float".
const FALLBACK_INSET = 0;

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

      // On Android, override --safe-bottom to use native value (avoids env() double-application)
      document.documentElement.style.setProperty('--safe-bottom', `${next}px`);
      document.documentElement.style.setProperty('--app-safe-bottom', `${next}px`);

      // TEMP diagnostics (shows in console logs)
      console.log('[AndroidSafeArea] bottomInset(px)=', next);
    };

    const setupInsets = async () => {
      try {
        // Use our custom native plugin (real WindowInsets)
        const AndroidInsets = (await import('@/plugins/androidInsets')).default;

        // Get initial insets
        const insets = await AndroidInsets.getInsets();
        applyBottomInset(insets.bottom);

        // Listen for inset changes (rotation, nav mode toggle, etc.)
        listenerHandle = await AndroidInsets.addListener('insetsChanged', (data) => {
          applyBottomInset(data.bottom);
        });
      } catch (error) {
        console.warn('[AndroidSafeArea] Native plugin not available, using fallback:', error);
        applyBottomInset(FALLBACK_INSET);
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
