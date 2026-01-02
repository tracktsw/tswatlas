import { useState, useEffect, useCallback } from 'react';

// Detect iOS Safari/WebView
function isIOS(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

interface IOSKeyboardState {
  keyboardHeight: number;
  isKeyboardOpen: boolean;
  isIOS: boolean;
}

export function useIOSKeyboard(): IOSKeyboardState {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const iosDevice = isIOS();

  const handleViewportChange = useCallback(() => {
    if (!iosDevice || !window.visualViewport) return;

    const vv = window.visualViewport;
    // Keyboard height = difference between window inner height and visual viewport height
    // Also account for any offset (when keyboard pushes viewport)
    const height = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    
    setKeyboardHeight(height);
    setIsKeyboardOpen(height > 100); // Threshold to ignore small adjustments
  }, [iosDevice]);

  useEffect(() => {
    if (!iosDevice || !window.visualViewport) return;

    const vv = window.visualViewport;
    vv.addEventListener('resize', handleViewportChange);
    vv.addEventListener('scroll', handleViewportChange);

    // Initial check
    handleViewportChange();

    return () => {
      vv.removeEventListener('resize', handleViewportChange);
      vv.removeEventListener('scroll', handleViewportChange);
    };
  }, [iosDevice, handleViewportChange]);

  return {
    keyboardHeight,
    isKeyboardOpen,
    isIOS: iosDevice,
  };
}
