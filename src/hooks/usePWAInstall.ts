import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'ios' | 'android' | 'other';

export function usePWAInstall() {
  const [platform, setPlatform] = useState<Platform>('other');
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Detect if running in Capacitor native app
    const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
    if (isCapacitor) {
      setIsNativeApp(true);
      return; // No need to check other conditions for native app
    }

    // Check if dismissed for this session only
    const dismissed = sessionStorage.getItem('pwa-install-dismissed-session');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    
    if (isIOS) {
      setPlatform('ios');
    } else if (isAndroid) {
      setPlatform('android');
    } else {
      setPlatform('other');
    }

    // Check if already installed as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (navigator as any).standalone === true;
    
    if (isStandalone || isIOSStandalone) {
      setIsInstalled(true);
    }

    // Listen for beforeinstallprompt (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const dismiss = () => {
    // Only dismiss for current session - will show again on next browser open
    sessionStorage.setItem('pwa-install-dismissed-session', 'true');
    setIsDismissed(true);
  };

  const triggerInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
  };

  const shouldShowPrompt = !isNativeApp && !isInstalled && !isDismissed && (platform === 'ios' || platform === 'android');

  return {
    platform,
    isInstalled,
    isDismissed,
    shouldShowPrompt,
    dismiss,
    triggerInstall,
    canTriggerInstall: !!deferredPrompt,
  };
}
