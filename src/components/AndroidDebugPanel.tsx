// F) Android Debug Panel for QA
// Visible only when ?insetsDebug=1 query param is present on Android
import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

const AndroidDebugPanel = () => {
  const [show, setShow] = useState(false);
  const [values, setValues] = useState<Record<string, string | number | undefined>>({});

  useEffect(() => {
    // Only show on Android with insetsDebug query param
    if (!new URLSearchParams(window.location.search).has('insetsDebug')) return;
    if (Capacitor.getPlatform() !== 'android') return;

    setShow(true);

    const update = () => {
      const root = document.documentElement;
      const computed = getComputedStyle(root);
      
      setValues({
        innerHeight: window.innerHeight,
        visualViewportHeight: window.visualViewport?.height,
        appVh: computed.getPropertyValue('--app-vh').trim() || 'not set',
        safeTop: computed.getPropertyValue('--safe-top').trim() || 'not set',
        safeBottom: computed.getPropertyValue('--safe-bottom').trim() || 'not set',
        appInsetTop: computed.getPropertyValue('--app-inset-top').trim() || 'not set',
        appInsetBottom: computed.getPropertyValue('--app-inset-bottom').trim() || 'not set',
        hasNavBar: computed.getPropertyValue('--android-has-nav-bar').trim() || 'not set',
        noNavBarClass: root.classList.contains('no-nav-bar') ? 'yes' : 'no',
      });
    };

    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);

    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed top-20 left-2 bg-black/90 text-white p-3 text-xs z-[9999] rounded-lg font-mono max-w-[280px] shadow-xl">
      <div className="font-bold text-green-400 mb-2">Android Debug Panel</div>
      <pre className="whitespace-pre-wrap break-all">
        {JSON.stringify(values, null, 2)}
      </pre>
    </div>
  );
};

export default AndroidDebugPanel;
