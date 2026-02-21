import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

// Detect iOS Safari/WebView
function detectIOS(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

// Detect Android via Capacitor
function detectAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
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
  isAndroid: boolean;
}

const IOSKeyboardContext = createContext<IOSKeyboardContextValue>({
  keyboardHeight: 0,
  isKeyboardOpen: false,
  isTextInputFocused: false,
  isIOS: false,
  isAndroid: false,
});

export function IOSKeyboardProvider({ children }: { children: React.ReactNode }) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isTextInputFocused, setIsTextInputFocused] = useState(false);
  const [isIOS] = useState(() => detectIOS());
  const [isAndroid] = useState(() => detectAndroid());

  // Compute isKeyboardOpen from either visualViewport OR focus state
  const isKeyboardOpen = isIOS && (keyboardHeight > 50 || isTextInputFocused);

  // Add platform classes to document for CSS targeting
  useEffect(() => {
    if (isIOS) {
      document.documentElement.classList.add('ios');
    }
    if (isAndroid) {
      document.documentElement.classList.add('android-edge');
    }
    return () => {
      document.documentElement.classList.remove('ios');
      document.documentElement.classList.remove('android-edge');
    };
  }, [isIOS, isAndroid]);

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

  // Focus-based detection (reliable fallback for iOS/Android WebViews)
  useEffect(() => {
    if (!isIOS && !isAndroid) return;

    let blurTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleFocusIn = (e: FocusEvent) => {
      if (blurTimeout) {
        clearTimeout(blurTimeout);
        blurTimeout = null;
      }
      if (isTextInputElement(e.target as Element)) {
        setIsTextInputFocused(true);
        
        // After keyboard animates open, scroll the focused element into view
        // so it isn't hidden behind the keyboard
        const target = e.target as HTMLElement;
        // Use multiple attempts to account for keyboard animation timing
        const scrollIntoViewSafely = () => {
          // Find the scrollable parent (main element)
          const scrollParent = target.closest('main') || target.closest('[class*="overflow-y-auto"]');
          if (scrollParent) {
            const targetRect = target.getBoundingClientRect();
            const scrollParentRect = scrollParent.getBoundingClientRect();
            // Calculate where the target is relative to the visible scroll area
            // We want it roughly in the upper-middle third of the visible area
            const visibleHeight = scrollParentRect.height;
            const targetTop = targetRect.top - scrollParentRect.top;
            const desiredPosition = visibleHeight * 0.3; // 30% from top of visible area
            const scrollAdjustment = targetTop - desiredPosition;
            
            scrollParent.scrollBy({ top: scrollAdjustment, behavior: 'smooth' });
          } else {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        };
        setTimeout(scrollIntoViewSafely, 300);
        setTimeout(scrollIntoViewSafely, 600);
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
    <IOSKeyboardContext.Provider value={{ keyboardHeight, isKeyboardOpen, isTextInputFocused, isIOS, isAndroid }}>
      {children}
    </IOSKeyboardContext.Provider>
  );
}

export function useIOSKeyboardContext() {
  return useContext(IOSKeyboardContext);
}
