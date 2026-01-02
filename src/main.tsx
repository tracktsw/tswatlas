import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import App from "./App.tsx";
import "./index.css";
import { initSafeAreaManager } from "./utils/safeAreaManager";

// Initialize safe area CSS variables
initSafeAreaManager();

// Configure native status bar on iOS/Android
if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: false })
    .then(() => {
      console.log('[StatusBar] overlaysWebView set to false');
    })
    .catch((err) => {
      console.warn('[StatusBar] Failed to configure:', err);
    });
  
  // Set status bar style to match app theme
  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
