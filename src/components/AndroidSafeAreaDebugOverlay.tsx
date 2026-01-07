import { useEffect, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAndroidSafeArea } from '@/contexts/AndroidSafeAreaContext';

const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

interface DebugValues {
  safeBottom: string;
  envSafeAreaBottom: string;
  innerHeight: number;
  vpHeight: number;
  vpOffsetTop: number;
  bottomInset: number;
  imeInset: number;
  navMode: string;
}

export const AndroidSafeAreaDebugOverlay = () => {
  const [enabled, setEnabled] = useState(false);
  const [values, setValues] = useState<DebugValues | null>(null);
  const probeRef = useRef<HTMLDivElement | null>(null);
  const { bottomInset, imeInset, navMode } = useAndroidSafeArea();

  // Enable via localStorage (tester-accessible in release builds) or query param
  useEffect(() => {
    // Check localStorage for tester access (persists across sessions)
    const storedPref = localStorage.getItem('debugSafeArea');
    if (storedPref === '1') {
      setEnabled(true);
      return;
    }
    
    // Check query param (can be used to enable and will persist to localStorage)
    const params = new URLSearchParams(window.location.search);
    if (params.get('debugSafeArea') === '1') {
      localStorage.setItem('debugSafeArea', '1');
      setEnabled(true);
    }
  }, []);

  // On iOS only: create probe for env(safe-area-inset-bottom)
  // Android doesn't use env() so we skip this
  useEffect(() => {
    if (!enabled) return;
    if (isNativeAndroid) return;

    const probe = document.createElement('div');
    probe.style.cssText = `
      position: fixed;
      top: -9999px;
      left: -9999px;
      width: 1px;
      height: 1px;
      padding-bottom: env(safe-area-inset-bottom, 0px);
      pointer-events: none;
      opacity: 0;
    `;
    document.body.appendChild(probe);
    probeRef.current = probe;

    return () => {
      if (probeRef.current) {
        document.body.removeChild(probeRef.current);
        probeRef.current = null;
      }
    };
  }, [enabled]);

  // Read and update values
  useEffect(() => {
    if (!enabled) return;

    const readValues = () => {
      // Read the single source of truth CSS variable
      const safeBottom = getComputedStyle(document.documentElement)
        .getPropertyValue('--safe-bottom')
        .trim() || '0px';

      const envSafeAreaBottom = isNativeAndroid
        ? 'n/a (disabled)'
        : probeRef.current
          ? getComputedStyle(probeRef.current).paddingBottom
          : '0px';

      const innerHeight = window.innerHeight;
      const vp = window.visualViewport;
      const vpHeight = vp?.height ?? innerHeight;
      const vpOffsetTop = vp?.offsetTop ?? 0;

      setValues({
        safeBottom,
        envSafeAreaBottom,
        innerHeight,
        vpHeight: Math.round(vpHeight),
        vpOffsetTop: Math.round(vpOffsetTop),
        bottomInset,
        imeInset,
        navMode,
      });
    };

    // Initial read
    readValues();

    // Listen to viewport changes
    const vp = window.visualViewport;
    vp?.addEventListener('resize', readValues);
    vp?.addEventListener('scroll', readValues);
    window.addEventListener('resize', readValues);

    // Also poll every 500ms to catch transient changes
    const interval = setInterval(readValues, 500);

    return () => {
      vp?.removeEventListener('resize', readValues);
      vp?.removeEventListener('scroll', readValues);
      window.removeEventListener('resize', readValues);
      clearInterval(interval);
    };
  }, [enabled, bottomInset, imeInset, navMode]);

  // Don't render if not enabled
  if (!enabled || !values) return null;

  const handleClose = () => {
    localStorage.removeItem('debugSafeArea');
    const url = new URL(window.location.href);
    url.searchParams.delete('debugSafeArea');
    window.history.replaceState({}, '', url.toString());
    setEnabled(false);
  };

  const isFallback = isNativeAndroid && values.bottomInset === 48;

  return (
    <div
      className="fixed top-2 left-2 z-[9999] bg-black/90 text-white p-3 rounded-lg text-xs font-mono max-w-[300px]"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-yellow-400">Safe Area Debug</span>
        <button
          onClick={handleClose}
          className="text-red-400 hover:text-red-300 ml-2"
        >
          ✕
        </button>
      </div>
      <div className="space-y-1">
        <div>
          <span className="text-gray-400">Platform:</span>{' '}
          <span className="text-purple-400">{isNativeAndroid ? 'android' : 'web/ios'}</span>
        </div>
        {isNativeAndroid && (
          <>
            <div>
              <span className="text-gray-400">navMode:</span>{' '}
              <span className="text-cyan-400">{values.navMode}</span>
            </div>
            <div>
              <span className="text-gray-400">nativeBottomInsetPx:</span>{' '}
              <span className="text-green-400 font-bold">{values.bottomInset}px</span>
            </div>
            <div>
              <span className="text-gray-400">imeInsetPx:</span>{' '}
              <span className="text-blue-400">{values.imeInset}px</span>
            </div>
            <div>
              <span className="text-gray-400">fallbackUsed:</span>{' '}
              <span className={isFallback ? 'text-orange-400' : 'text-green-400'}>
                {isFallback ? 'true' : 'false'}
              </span>
            </div>
          </>
        )}
        <div className="pt-1 border-t border-gray-600">
          <span className="text-gray-400">--safe-bottom:</span>{' '}
          <span className="text-green-400 font-bold">{values.safeBottom}</span>
        </div>
        {!isNativeAndroid && (
          <div>
            <span className="text-gray-400">env(safe-area-inset-bottom):</span>{' '}
            <span className="text-blue-400">{values.envSafeAreaBottom}</span>
          </div>
        )}
        <div className="pt-1 border-t border-gray-600">
          <span className="text-gray-400">innerHeight:</span>{' '}
          <span className="text-blue-400">{values.innerHeight}px</span>
        </div>
        <div>
          <span className="text-gray-400">vpHeight:</span>{' '}
          <span className="text-blue-400">{values.vpHeight}px</span>
        </div>
      </div>
    </div>
  );
};
