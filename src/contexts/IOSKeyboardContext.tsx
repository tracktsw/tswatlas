import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Detect iOS Safari/WebView
function detectIOS(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

interface IOSKeyboardContextValue {
  keyboardHeight: number;
  isKeyboardOpen: boolean;
  isIOS: boolean;
}

const IOSKeyboardContext = createContext<IOSKeyboardContextValue>({
  keyboardHeight: 0,
  isKeyboardOpen: false,
  isIOS: false,
});

export function IOSKeyboardProvider({ children }: { children: React.ReactNode }) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isIOS] = useState(() => detectIOS());

  const handleViewportChange = useCallback(() => {
    if (!isIOS || !window.visualViewport) return;

    const vv = window.visualViewport;
    // Keyboard height = difference between window inner height and visual viewport height
    // Also account for any offset (when keyboard pushes viewport)
    const height = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    
    setKeyboardHeight(height);
    setIsKeyboardOpen(height > 100); // Threshold to ignore small adjustments
  }, [isIOS]);

  useEffect(() => {
    if (!isIOS || !window.visualViewport) return;

    const vv = window.visualViewport;
    vv.addEventListener('resize', handleViewportChange);
    vv.addEventListener('scroll', handleViewportChange);

    // Initial check
    handleViewportChange();

    return () => {
      vv.removeEventListener('resize', handleViewportChange);
      vv.removeEventListener('scroll', handleViewportChange);
    };
  }, [isIOS, handleViewportChange]);

  return (
    <IOSKeyboardContext.Provider value={{ keyboardHeight, isKeyboardOpen, isIOS }}>
      {children}
    </IOSKeyboardContext.Provider>
  );
}

export function useIOSKeyboardContext() {
  return useContext(IOSKeyboardContext);
}
