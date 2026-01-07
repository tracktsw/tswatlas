import { useEffect, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

interface DebugValues {
  androidBottomInset: string;
  envSafeAreaBottom: string;
  innerHeight: number;
  vpHeight: number;
  vpOffsetTop: number;
  bottomOcclusion: number;
}

export const AndroidSafeAreaDebugOverlay = () => {
  const [enabled, setEnabled] = useState(false);
  const [values, setValues] = useState<DebugValues | null>(null);
  const probeRef = useRef<HTMLDivElement | null>(null);

  // TEMPORARY: Always enable on native Android for debugging
  // Revert to query param check after debugging is complete
  useEffect(() => {
    if (isNativeAndroid) {
      setEnabled(true);
    } else {
      const params = new URLSearchParams(window.location.search);
      setEnabled(params.get('debugSafeArea') === '1');
    }
  }, []);

  // Create probe element for reading env(safe-area-inset-bottom)
  useEffect(() => {
    if (!enabled || !isNativeAndroid) return;

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
    if (!enabled || !isNativeAndroid) return;

    const readValues = () => {
      const androidBottomInset = getComputedStyle(document.documentElement)
        .getPropertyValue('--android-bottom-inset')
        .trim() || '0px';

      const envSafeAreaBottom = probeRef.current
        ? getComputedStyle(probeRef.current).paddingBottom
        : '0px';

      const innerHeight = window.innerHeight;
      const vp = window.visualViewport;
      const vpHeight = vp?.height ?? innerHeight;
      const vpOffsetTop = vp?.offsetTop ?? 0;
      const bottomOcclusion = Math.max(0, Math.round(innerHeight - vpHeight - vpOffsetTop));

      setValues({
        androidBottomInset,
        envSafeAreaBottom,
        innerHeight,
        vpHeight: Math.round(vpHeight),
        vpOffsetTop: Math.round(vpOffsetTop),
        bottomOcclusion,
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
  }, [enabled]);

  // Don't render if not enabled or not native Android
  if (!enabled || !isNativeAndroid || !values) return null;

  const handleClose = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('debugSafeArea');
    window.history.replaceState({}, '', url.toString());
    setEnabled(false);
  };

  return (
    <div
      className="fixed top-2 left-2 z-[9999] bg-black/80 text-white p-3 rounded-lg text-xs font-mono max-w-[280px]"
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
          <span className="text-gray-400">--android-bottom-inset:</span>{' '}
          <span className="text-green-400">{values.androidBottomInset}</span>
        </div>
        <div>
          <span className="text-gray-400">env(safe-area-inset-bottom):</span>{' '}
          <span className="text-green-400">{values.envSafeAreaBottom}</span>
        </div>
        <div>
          <span className="text-gray-400">window.innerHeight:</span>{' '}
          <span className="text-blue-400">{values.innerHeight}px</span>
        </div>
        <div>
          <span className="text-gray-400">visualViewport.height:</span>{' '}
          <span className="text-blue-400">{values.vpHeight}px</span>
        </div>
        <div>
          <span className="text-gray-400">visualViewport.offsetTop:</span>{' '}
          <span className="text-blue-400">{values.vpOffsetTop}px</span>
        </div>
        <div className="pt-1 border-t border-gray-600">
          <span className="text-gray-400">bottomOcclusion (derived):</span>{' '}
          <span className="text-orange-400 font-bold">{values.bottomOcclusion}px</span>
        </div>
      </div>
    </div>
  );
};
