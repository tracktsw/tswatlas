import { useEffect, useState } from 'react';

interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export const useSafeArea = () => {
  const [insets, setInsets] = useState<SafeAreaInsets>({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    const updateInsets = () => {
      // Check if we're on iOS first
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      if (isIOS) {
        // On iOS, use CSS env variables which iOS sets correctly
        const computedStyle = getComputedStyle(document.documentElement);
        const cssTop = parseInt(computedStyle.getPropertyValue('--safe-top').replace('px', '')) || 0;
        const cssBottom = parseInt(computedStyle.getPropertyValue('--safe-bottom').replace('px', '')) || 0;
        
        // If CSS variables exist, use them (iOS path)
        if (cssTop > 0 || cssBottom > 0) {
          setInsets({ top: cssTop, bottom: cssBottom, left: 0, right: 0 });
          console.log('[SafeArea] iOS using existing CSS variables:', { top: cssTop, bottom: cssBottom });
          return;
        }
        
        // iOS with no CSS vars - don't calculate, leave as 0
        setInsets({ top: 0, bottom: 0, left: 0, right: 0 });
        document.documentElement.style.setProperty('--safe-top', '0px');
        document.documentElement.style.setProperty('--safe-bottom', '0px');
        console.log('[SafeArea] iOS with no CSS vars, using 0');
        return;
      }
      
      // Android path - use visualViewport
      const vv = window.visualViewport;
      if (!vv) {
        setInsets({ top: 0, bottom: 0, left: 0, right: 0 });
        document.documentElement.style.setProperty('--safe-top', '0px');
        document.documentElement.style.setProperty('--safe-bottom', '0px');
        return;
      }

      const top = Math.max(0, vv.offsetTop);
      const bottom = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));

      // Set CSS variables globally
      document.documentElement.style.setProperty('--safe-top', `${top}px`);
      document.documentElement.style.setProperty('--safe-bottom', `${bottom}px`);

      // Update state
      setInsets({
        top,
        bottom,
        left: 0,
        right: 0,
      });

      console.log('[SafeArea] Android Visual Viewport insets:', { top, bottom });
    };

    // Initial update
    updateInsets();

    // Listen for changes
    window.visualViewport?.addEventListener('resize', updateInsets);
    window.addEventListener('orientationchange', updateInsets);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateInsets);
      window.removeEventListener('orientationchange', updateInsets);
    };
  }, []);

  return insets;
};