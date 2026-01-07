import { createContext, useContext, useEffect, ReactNode, useState } from 'react';
import { Capacitor } from '@capacitor/core';

interface AndroidSafeAreaContextType {
  bottomInset: number;
}

const AndroidSafeAreaContext = createContext<AndroidSafeAreaContextType>({ bottomInset: 0 });

export const useAndroidSafeArea = () => useContext(AndroidSafeAreaContext);

export const AndroidSafeAreaProvider = ({ children }: { children: ReactNode }) => {
  const [bottomInset, setBottomInset] = useState(0);
  const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  useEffect(() => {
    if (!isNativeAndroid) return;

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const setupSafeArea = async () => {
      try {
        const { SafeArea } = await import('capacitor-plugin-safe-area');
        
        // Enable immersive/edge-to-edge mode so the app renders behind the nav bar
        await SafeArea.setImmersiveNavigationBar();
        
        // Get initial insets
        const { insets } = await SafeArea.getSafeAreaInsets();
        
        // Use actual value - don't clamp (nav bars can be 48-96px)
        const bottomValue = Math.max(insets.bottom, 0);
        setBottomInset(bottomValue);
        
        document.documentElement.style.setProperty(
          '--android-bottom-inset',
          `${bottomValue}px`
        );

        // Listen for changes (rotation, keyboard, etc.)
        listenerHandle = await SafeArea.addListener('safeAreaChanged', ({ insets }) => {
          const newBottom = Math.max(insets.bottom, 0);
          setBottomInset(newBottom);
          document.documentElement.style.setProperty(
            '--android-bottom-inset',
            `${newBottom}px`
          );
        });

      } catch (error) {
        console.warn('Failed to setup Android safe area:', error);
        document.documentElement.style.setProperty('--android-bottom-inset', '0px');
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
