import { useEffect, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAndroidSafeArea } from '@/contexts/AndroidSafeAreaContext';

const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

interface DebugValues {
  safeBottom: string;
  androidSafeBottom: string;
  envSafeAreaBottom: string;
  innerHeight: number;
  vpHeight: number;
}

export const AndroidSafeAreaDebugOverlay = () => {
  const [enabled, setEnabled] = useState(false);
  const [values, setValues] = useState<DebugValues | null>(null);
  const probeRef = useRef<HTMLDivElement | null>(null);
  const { bottomInset, navMode, fallbackUsed } = useAndroidSafeArea();

  // Enable via localStorage or query param
  useEffect(() => {
    const storedPref = localStorage.getItem('debugSafeArea');
    if (storedPref === '1') {
      setEnabled(true);
      return;
    }
    
    const params = new URLSearchParams(window.location.search);
    if (params.get('debugSafeArea') === '1') {
      localStorage.setItem('debugSafeArea', '1');
      setEnabled(true);
    }
  }, []);

  // Create probe for env(safe-area-inset-bottom) on non-Android
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
      const styles = getComputedStyle(document.documentElement);
      const safeBottom = styles.getPropertyValue('--safe-bottom').trim() || '0px';
      const androidSafeBottom = styles.getPropertyValue('--android-safe-bottom').trim() || '0px';

      const envSafeAreaBottom = isNativeAndroid
        ? 'n/a (Android)'
        : probeRef.current
          ? getComputedStyle(probeRef.current).paddingBottom
          : '0px';

      const innerHeight = window.innerHeight;
      const vp = window.visualViewport;
      const vpHeight = vp?.height ?? innerHeight;

      setValues({
        safeBottom,
        androidSafeBottom,
        envSafeAreaBottom,
        innerHeight,
        vpHeight: Math.round(vpHeight),
      });
    };

    readValues();

    const vp = window.visualViewport;
    vp?.addEventListener('resize', readValues);
    window.addEventListener('resize', readValues);
    const interval = setInterval(readValues, 500);

    return () => {
      vp?.removeEventListener('resize', readValues);
      window.removeEventListener('resize', readValues);
      clearInterval(interval);
    };
  }, [enabled]);

  if (!enabled || !values) return null;

  const handleClose = () => {
    localStorage.removeItem('debugSafeArea');
    const url = new URL(window.location.href);
    url.searchParams.delete('debugSafeArea');
    window.history.replaceState({}, '', url.toString());
    setEnabled(false);
  };

  return (
    <div
      className="fixed top-2 left-2 z-[9999] bg-black/90 text-white p-3 rounded-lg text-xs font-mono max-w-[280px]"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-yellow-400">Safe Area Debug</span>
        <button onClick={handleClose} className="text-red-400 hover:text-red-300 ml-2">✕</button>
      </div>
      <div className="space-y-1">
        <div>
          <span className="text-gray-400">Platform:</span>{' '}
          <span className="text-purple-400">{isNativeAndroid ? 'android-native' : 'web/ios'}</span>
        </div>
        <div>
          <span className="text-gray-400">navMode:</span>{' '}
          <span className="text-cyan-400">{navMode}</span>
        </div>
        <div>
          <span className="text-gray-400">bottomInset:</span>{' '}
          <span className="text-green-400 font-bold">{bottomInset}px</span>
        </div>
        <div>
          <span className="text-gray-400">fallbackUsed:</span>{' '}
          <span className={fallbackUsed ? 'text-orange-400 font-bold' : 'text-green-400'}>
            {fallbackUsed ? 'TRUE' : 'false'}
          </span>
        </div>
        <div className="pt-1 border-t border-gray-600">
          <span className="text-gray-400">--safe-bottom:</span>{' '}
          <span className="text-blue-400">{values.safeBottom}</span>
        </div>
        <div>
          <span className="text-gray-400">--android-safe-bottom:</span>{' '}
          <span className="text-green-400 font-bold">{values.androidSafeBottom}</span>
        </div>
        {!isNativeAndroid && (
          <div>
            <span className="text-gray-400">env(safe-area-inset-bottom):</span>{' '}
            <span className="text-blue-400">{values.envSafeAreaBottom}</span>
          </div>
        )}
      </div>
    </div>
  );
};
