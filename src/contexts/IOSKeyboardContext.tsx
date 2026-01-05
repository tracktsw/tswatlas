import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Detect iOS Safari/WebView
function detectIOS(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

// Check if element is a text input that would trigger keyboard
function isTextInputElement(element: Element | null): boolean {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  if (tagName === 'textarea') return true;
  if (tagName === 'input') {
    const type = (element as HTMLInputElement).type.toLowerCase();
    // These input types trigger the keyboard
    return ['text', 'password', 'email', 'search', 'tel', 'url', 'number'].includes(type);
  }
  // Check for contenteditable
  if (element.getAttribute('contenteditable') === 'true') return true;
  return false;
}

interface IOSKeyboardContextValue {
  keyboardHeight: number;
  isKeyboardOpen: boolean;
  isTextInputFocused: boolean;
  isIOS: boolean;
}

const IOSKeyboardContext = createContext<IOSKeyboardContextValue>({
  keyboardHeight: 0,
  isKeyboardOpen: false,
  isTextInputFocused: false,
  isIOS: false,
});

export function IOSKeyboardProvider({ children }: { children: React.ReactNode }) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isTextInputFocused, setIsTextInputFocused] = useState(false);
  const [isIOS] = useState(() => detectIOS());

  // Compute isKeyboardOpen from either visualViewport OR focus state
  const isKeyboardOpen = isIOS && (keyboardHeight > 50 || isTextInputFocused);

  // Add iOS class to document for CSS targeting
  useEffect(() => {
    if (isIOS) {
      document.documentElement.classList.add('ios');
    }
    return () => {
      document.documentElement.classList.remove('ios');
    };
  }, [isIOS]);

  // Document-level scroll lock for iOS when keyboard is open
  // SIMPLIFIED: Only set a CSS custom property, let Layout handle overflow
  // This prevents the aggressive position:fixed which was breaking scrolling
  useEffect(() => {
    if (!isIOS) return;

    if (isKeyboardOpen) {
      document.documentElement.style.setProperty('--keyboard-open', '1');
    } else {
      document.documentElement.style.removeProperty('--keyboard-open');
    }

    // Cleanup on unmount
    return () => {
      document.documentElement.style.removeProperty('--keyboard-open');
    };
  }, [isIOS, isKeyboardOpen]);

  // Handle visualViewport changes (may not work in all iOS WebViews)
  const handleViewportChange = useCallback(() => {
    if (!isIOS || !window.visualViewport) return;

    const vv = window.visualViewport;
    // Simple formula: keyboard height = window height minus viewport height
    const height = Math.max(0, window.innerHeight - vv.height);
    setKeyboardHeight(height);
  }, [isIOS]);

  // Listen to visualViewport events
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

  // Focus-based detection (reliable fallback for iOS WebViews)
  useEffect(() => {
    if (!isIOS) return;

    let blurTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleFocusIn = (e: FocusEvent) => {
      if (blurTimeout) {
        clearTimeout(blurTimeout);
        blurTimeout = null;
      }
      if (isTextInputElement(e.target as Element)) {
        setIsTextInputFocused(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      if (isTextInputElement(e.target as Element)) {
        // Delay to avoid flicker when moving between inputs
        blurTimeout = setTimeout(() => {
          setIsTextInputFocused(false);
        }, 150);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      if (blurTimeout) clearTimeout(blurTimeout);
    };
  }, [isIOS]);

  // Safety net: if focus tracking gets stuck (common when closing modals on iOS),
  // periodically re-check the actual activeElement.
  useEffect(() => {
    if (!isIOS || !isTextInputFocused) return;

    const id = window.setInterval(() => {
      const active = document.activeElement;
      if (!isTextInputElement(active)) {
        setIsTextInputFocused(false);
      }
    }, 250);

    return () => window.clearInterval(id);
  }, [isIOS, isTextInputFocused]);

  return (
    <IOSKeyboardContext.Provider value={{ keyboardHeight, isKeyboardOpen, isTextInputFocused, isIOS }}>
      {children}
    </IOSKeyboardContext.Provider>
  );
}

export function useIOSKeyboardContext() {
  return useContext(IOSKeyboardContext);
}
