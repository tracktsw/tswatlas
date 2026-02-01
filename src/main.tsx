import { createRoot } from "react-dom/client";
import posthog from 'posthog-js';
import App from "./App.tsx";
import "./index.css";
import { Capacitor } from '@capacitor/core';
import { SafeArea } from 'capacitor-plugin-safe-area';

// Initialize PostHog analytics (once at app startup)
posthog.init('phc_ioqVGTp9J1lA0SMfDVKEAibkUVtZTaWuwDR8n81zWhx', {
  api_host: 'https://eu.i.posthog.com',
  person_profiles: 'identified_only',
  capture_pageview: true,
  autocapture: false,
  persistence: 'localStorage',
});

const platform = Capacitor.getPlatform();

// A) Add Android platform class to document
if (platform === 'android') {
  document.documentElement.classList.add('platform-android');
  document.body.classList.add('platform-android');
}

// B) Create robust viewport height CSS variable for Android only
// Uses visualViewport API when available for accurate measurement
if (platform === 'android') {
  const updateAppVh = () => {
    const vh = (window.visualViewport?.height ?? window.innerHeight) * 0.01;
    document.documentElement.style.setProperty('--app-vh', `${vh}px`);
  };
  
  updateAppVh();
  window.addEventListener('resize', updateAppVh);
  window.visualViewport?.addEventListener('resize', updateAppVh);
}

// Initialize safe area insets for both iOS and Android
if (Capacitor.isNativePlatform()) {
  SafeArea.getSafeAreaInsets().then(({ insets }) => {
    console.log('SafeArea insets - top:', insets.top, 'bottom:', insets.bottom, 'left:', insets.left, 'right:', insets.right);
    console.log('Platform:', platform);
    
    const root = document.documentElement;
    
    // Set BOTH the plugin's default names AND our custom names
    root.style.setProperty('--safe-area-inset-top', `${insets.top}px`);
    root.style.setProperty('--safe-area-inset-bottom', `${insets.bottom}px`);
    root.style.setProperty('--safe-area-inset-left', `${insets.left}px`);
    root.style.setProperty('--safe-area-inset-right', `${insets.right}px`);
    
    // Also set our custom shorter names
    root.style.setProperty('--safe-top', `${insets.top}px`);
    root.style.setProperty('--safe-bottom', `${insets.bottom}px`);
    root.style.setProperty('--safe-left', `${insets.left}px`);
    root.style.setProperty('--safe-right', `${insets.right}px`);
    
    // Android: detect if device has a nav bar or uses full gesture navigation
    // Nav bar typically has inset >= 48px, gesture nav has 0-24px
    if (platform === 'android') {
      const hasNavBar = insets.bottom >= 48;
      root.style.setProperty('--android-has-nav-bar', hasNavBar ? '1' : '0');
      
      // Add class for CSS targeting
      if (!hasNavBar) {
        root.classList.add('no-nav-bar');
        document.body.classList.add('no-nav-bar');
      } else {
        root.classList.remove('no-nav-bar');
        document.body.classList.remove('no-nav-bar');
      }
      
      console.log('Android nav bar detection - hasNavBar:', hasNavBar, 'bottomInset:', insets.bottom);
    }
    
    console.log('CSS variables set - bottom:', root.style.getPropertyValue('--safe-bottom'));
  }).catch((error) => {
    console.error('SafeArea plugin error:', error);
  });

  // Listen for orientation changes and update insets
  SafeArea.addListener('safeAreaChanged', (data) => {
    console.log('SafeArea changed - top:', data.insets.top, 'bottom:', data.insets.bottom);
    const root = document.documentElement;
    
    root.style.setProperty('--safe-area-inset-top', `${data.insets.top}px`);
    root.style.setProperty('--safe-area-inset-bottom', `${data.insets.bottom}px`);
    root.style.setProperty('--safe-area-inset-left', `${data.insets.left}px`);
    root.style.setProperty('--safe-area-inset-right', `${data.insets.right}px`);
    
    root.style.setProperty('--safe-top', `${data.insets.top}px`);
    root.style.setProperty('--safe-bottom', `${data.insets.bottom}px`);
    root.style.setProperty('--safe-left', `${data.insets.left}px`);
    root.style.setProperty('--safe-right', `${data.insets.right}px`);
    
    // Android: update nav bar detection on orientation change
    if (platform === 'android') {
      const hasNavBar = data.insets.bottom >= 48;
      root.style.setProperty('--android-has-nav-bar', hasNavBar ? '1' : '0');
      
      if (!hasNavBar) {
        root.classList.add('no-nav-bar');
        document.body.classList.add('no-nav-bar');
      } else {
        root.classList.remove('no-nav-bar');
        document.body.classList.remove('no-nav-bar');
      }
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);