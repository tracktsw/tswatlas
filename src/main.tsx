import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Capacitor } from '@capacitor/core';
import { SafeArea } from 'capacitor-plugin-safe-area';

// Initialize safe area insets for both iOS and Android
if (Capacitor.isNativePlatform()) {
  SafeArea.getSafeAreaInsets().then(({ insets }) => {
    console.log('SafeArea insets - top:', insets.top, 'bottom:', insets.bottom, 'left:', insets.left, 'right:', insets.right);
    console.log('Platform:', Capacitor.getPlatform());
    
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
  });
}

createRoot(document.getElementById("root")!).render(<App />);