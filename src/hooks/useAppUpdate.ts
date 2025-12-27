import { useState, useEffect, useCallback } from "react";
import { APP_VERSION, VERSION_STORAGE_KEY, UPDATE_DISMISSED_KEY } from "@/config/version";

const DISMISS_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

interface RemoteVersion {
  version: string;
}

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);

  const checkForUpdate = useCallback(async (force = false) => {
    setIsChecking(true);
    
    try {
      // Fetch remote version with cache-busting
      const response = await fetch(`/version.json?ts=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        console.warn('Failed to fetch version.json');
        return false;
      }
      
      const data: RemoteVersion = await response.json();
      const fetchedVersion = data.version;
      setRemoteVersion(fetchedVersion);
      
      // Check if remote version is newer than running version
      if (fetchedVersion !== APP_VERSION) {
        // Check if user dismissed recently (within cooldown period)
        if (!force) {
          const dismissedAt = localStorage.getItem(UPDATE_DISMISSED_KEY);
          if (dismissedAt) {
            const dismissedTime = parseInt(dismissedAt, 10);
            if (Date.now() - dismissedTime < DISMISS_COOLDOWN_MS) {
              // Still in cooldown, don't show update
              return false;
            }
          }
        }
        
        setUpdateAvailable(true);
        return true;
      }
      
      // Store current version if matching
      localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
      setUpdateAvailable(false);
      return false;
    } catch (error) {
      console.error("Failed to check for updates:", error);
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
    } catch (error) {
      console.error("Update failed:", error);
      // Still try to reload even if cache clear fails
      window.location.reload();
    }
  };

  const dismissUpdate = () => {
    // Store dismissal time for cooldown
    localStorage.setItem(UPDATE_DISMISSED_KEY, Date.now().toString());
    setUpdateAvailable(false);
  };

  // Check for updates on mount and visibility change
  useEffect(() => {
    // Initial check
    checkForUpdate();

    // Check when app returns to foreground (iOS PWA resume)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };

    // Check on focus (additional safety for iOS)
    const handleFocus = () => {
      checkForUpdate();
    };

    // Check on page show (handles bfcache)
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        checkForUpdate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
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
