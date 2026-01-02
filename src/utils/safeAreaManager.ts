/**
 * Safe Area Manager
 * Detects and sets CSS custom properties for safe area insets
 * Works as a fallback when native env() values are unreliable in iOS WebViews
 */

export function initSafeAreaManager() {
  const root = document.documentElement;

  const updateSafeAreas = () => {
    // Try to get values from visualViewport (most reliable on iOS)
    const vv = window.visualViewport;
    
    // For top inset: use visualViewport.offsetTop if available
    // This represents the offset from the top of the layout viewport
    let topInset = 0;
    if (vv && vv.offsetTop > 0) {
      topInset = vv.offsetTop;
    }
    
    // Fallback: try to read computed env value
    if (topInset === 0) {
      const testEl = document.createElement('div');
      testEl.style.paddingTop = 'env(safe-area-inset-top, 0px)';
      document.body.appendChild(testEl);
      const computed = getComputedStyle(testEl).paddingTop;
      topInset = parseFloat(computed) || 0;
      document.body.removeChild(testEl);
    }
    
    // For iOS devices without proper env() support, use device detection heuristic
    if (topInset === 0 && isIOSDevice()) {
      // iPhone X and later have ~47-59px notch area depending on model
      // This is a safe fallback for the status bar + notch
      topInset = getIOSTopInset();
    }

    // Bottom inset calculation
    let bottomInset = 0;
    if (vv) {
      // The difference between window.innerHeight and visualViewport.height
      // can indicate bottom inset (home indicator area)
      const heightDiff = window.innerHeight - vv.height - (vv.offsetTop || 0);
      if (heightDiff > 0) {
        bottomInset = heightDiff;
      }
    }
    
    // Fallback for bottom
    if (bottomInset === 0) {
      const testEl = document.createElement('div');
      testEl.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
      document.body.appendChild(testEl);
      const computed = getComputedStyle(testEl).paddingBottom;
      bottomInset = parseFloat(computed) || 0;
      document.body.removeChild(testEl);
    }

    // Set CSS custom properties
    root.style.setProperty('--safe-top', `${topInset}px`);
    root.style.setProperty('--safe-bottom', `${bottomInset}px`);
    
    // Also store raw values for debugging
    root.style.setProperty('--safe-top-value', `${topInset}`);
    root.style.setProperty('--safe-bottom-value', `${bottomInset}`);
  };

  // Initial update
  updateSafeAreas();
  
  // Update on resize and orientation change
  window.addEventListener('resize', updateSafeAreas);
  window.addEventListener('orientationchange', updateSafeAreas);
  
  // Update when visualViewport changes (iOS keyboard, etc.)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateSafeAreas);
    window.visualViewport.addEventListener('scroll', updateSafeAreas);
  }
}

function isIOSDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function getIOSTopInset(): number {
  // Detect screen dimensions to estimate notch size
  const screenHeight = window.screen.height;
  const screenWidth = window.screen.width;
  const pixelRatio = window.devicePixelRatio || 1;
  
  // iPhone X and later detection based on screen dimensions
  // These have the notch/Dynamic Island
  const isNotchedPhone = (
    // iPhone X, XS, 11 Pro, 12 mini, 13 mini (375x812)
    (screenWidth === 375 && screenHeight === 812) ||
    // iPhone XR, XS Max, 11, 11 Pro Max (414x896)
    (screenWidth === 414 && screenHeight === 896) ||
    // iPhone 12, 12 Pro, 13, 13 Pro, 14 (390x844)
    (screenWidth === 390 && screenHeight === 844) ||
    // iPhone 12 Pro Max, 13 Pro Max, 14 Plus (428x926)
    (screenWidth === 428 && screenHeight === 926) ||
    // iPhone 14 Pro (393x852)
    (screenWidth === 393 && screenHeight === 852) ||
    // iPhone 14 Pro Max (430x932)
    (screenWidth === 430 && screenHeight === 932) ||
    // iPhone 15, 15 Pro (393x852)
    // iPhone 15 Plus, 15 Pro Max (430x932)
    // iPhone 16 series - similar dimensions
    (screenHeight >= 812 && pixelRatio >= 3)
  );
  
  if (isNotchedPhone) {
    // Dynamic Island phones (iPhone 14 Pro+) have slightly different safe area
    const hasDynamicIsland = screenWidth >= 393 && screenHeight >= 852;
    return hasDynamicIsland ? 59 : 47;
  }
  
  // Standard status bar height for older iPhones
  return 20;
}
