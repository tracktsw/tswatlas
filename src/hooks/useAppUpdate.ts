import { useState, useEffect, useCallback, useRef } from "react";
import { APP_VERSION, VERSION_STORAGE_KEY, UPDATE_DISMISSED_KEY } from "@/config/version";

const DISMISS_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface RemoteVersion {
  version: string;
}

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
  const hasShownPromptRef = useRef(false);

  const checkForUpdate = useCallback(async (force = false) => {
    setIsChecking(true);
    
    try {
      // Enhanced cache-busting for iOS PWA
      const cacheBuster = `ts=${Date.now()}&r=${Math.random().toString(36).substring(2)}`;
      const url = `/version.json?${cacheBuster}`;
      
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data: RemoteVersion = await response.json();
      const fetchedVersion = data.version;
      setRemoteVersion(fetchedVersion);
      
      // Check if remote version is different from running version
      if (fetchedVersion !== APP_VERSION) {
        // Check if user dismissed recently (within cooldown period)
        if (!force) {
          const dismissedAt = localStorage.getItem(UPDATE_DISMISSED_KEY);
          if (dismissedAt) {
            const dismissedTime = parseInt(dismissedAt, 10);
            const timeRemaining = DISMISS_COOLDOWN_MS - (Date.now() - dismissedTime);
            if (timeRemaining > 0) {
              return false;
            }
          }
        }
        
        // Only show prompt once per session for same version
        if (!hasShownPromptRef.current || force) {
          hasShownPromptRef.current = true;
          setUpdateAvailable(true);
        }
        return true;
      }
      // Store current version if matching
      localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
      setUpdateAvailable(false);
      return false;
    } catch (error) {
      console.error("[UPDATE] Check failed:", error);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const performUpdate = async () => {
    setIsUpdating(true);
    
    try {
      // Clear all caches
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      // Unregister all service workers
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }

      // Clear dismissed timestamp
      localStorage.removeItem(UPDATE_DISMISSED_KEY);
      
      // Update stored version
      localStorage.setItem(VERSION_STORAGE_KEY, remoteVersion || APP_VERSION);

      // Force hard reload with cache-busting
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('v', remoteVersion || Date.now().toString());
      window.location.replace(newUrl.toString());
    } catch {
      // Still try to reload even if cache clear fails
      window.location.reload();
    }
  };

  const dismissUpdate = () => {
    // Store dismissal time for cooldown
    localStorage.setItem(UPDATE_DISMISSED_KEY, Date.now().toString());
    setUpdateAvailable(false);
  };

  // Check for updates on mount, visibility change, and periodically
  useEffect(() => {
    // Initial check on mount
    checkForUpdate(false);

    // Periodic polling every 5 minutes
    const pollInterval = setInterval(() => {
      checkForUpdate(false);
    }, POLL_INTERVAL_MS);

    // Check when app returns to foreground (iOS PWA resume)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate(false);
      }
    };

    // Check on page show (handles bfcache)
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        checkForUpdate(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [checkForUpdate]);

  return {
    updateAvailable,
    isUpdating,
    isChecking,
    performUpdate,
    dismissUpdate,
    checkForUpdate,
    currentVersion: APP_VERSION,
    remoteVersion,
  };
}
