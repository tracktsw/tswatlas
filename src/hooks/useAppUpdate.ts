import { useState, useEffect, useCallback, useRef } from "react";
import { APP_VERSION, VERSION_STORAGE_KEY, UPDATE_DISMISSED_KEY } from "@/config/version";

const DISMISS_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds

interface RemoteVersion {
  version: string;
}

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
  const hasShownPromptRef = useRef(false);

  console.log(`[UPDATE] App running version: ${APP_VERSION}`);

  const checkForUpdate = useCallback(async (force = false, source = 'unknown') => {
    console.log(`[UPDATE] Check triggered (source: ${source})`);
    setIsChecking(true);
    
    try {
      // Enhanced cache-busting for iOS PWA
      const cacheBuster = `ts=${Date.now()}&r=${Math.random().toString(36).substring(2)}`;
      const url = `/version.json?${cacheBuster}`;
      
      console.log(`[UPDATE] Fetching ${url}...`);
      
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        console.warn('[UPDATE] Failed to fetch version.json:', response.status);
        return false;
      }
      
      const data: RemoteVersion = await response.json();
      const fetchedVersion = data.version;
      setRemoteVersion(fetchedVersion);
      
      console.log(`[UPDATE] Remote version: ${fetchedVersion}, Current: ${APP_VERSION}`);
      
      // Check if remote version is different from running version
      if (fetchedVersion !== APP_VERSION) {
        console.log(`[UPDATE] Update available! ${APP_VERSION} → ${fetchedVersion}`);
        
        // Check if user dismissed recently (within cooldown period)
        if (!force) {
          const dismissedAt = localStorage.getItem(UPDATE_DISMISSED_KEY);
          if (dismissedAt) {
            const dismissedTime = parseInt(dismissedAt, 10);
            const timeRemaining = DISMISS_COOLDOWN_MS - (Date.now() - dismissedTime);
            if (timeRemaining > 0) {
              console.log(`[UPDATE] User dismissed update, cooldown remaining: ${Math.round(timeRemaining / 1000)}s`);
              return false;
            }
          }
        }
        
        // Only show prompt once per session for same version
        if (!hasShownPromptRef.current || force) {
          console.log('[UPDATE] Showing update prompt');
          hasShownPromptRef.current = true;
          setUpdateAvailable(true);
        }
        return true;
      }
      
      console.log('[UPDATE] No update available (versions match)');
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
    console.log('[UPDATE] User tapped "Refresh now"');
    setIsUpdating(true);
    
    try {
      // Clear all caches
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        console.log(`[UPDATE] Clearing ${cacheNames.length} caches...`);
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      // Unregister all service workers
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log(`[UPDATE] Unregistering ${registrations.length} service workers...`);
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }

      // Clear dismissed timestamp
      localStorage.removeItem(UPDATE_DISMISSED_KEY);
      
      // Update stored version
      localStorage.setItem(VERSION_STORAGE_KEY, remoteVersion || APP_VERSION);

      console.log('[UPDATE] Performing hard reload...');
      
      // Force hard reload with cache-busting
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('v', remoteVersion || Date.now().toString());
      window.location.replace(newUrl.toString());
    } catch (error) {
      console.error("[UPDATE] Update failed:", error);
      // Still try to reload even if cache clear fails
      window.location.reload();
    }
  };

  const dismissUpdate = () => {
    console.log('[UPDATE] User tapped "Later"');
    // Store dismissal time for cooldown
    localStorage.setItem(UPDATE_DISMISSED_KEY, Date.now().toString());
    setUpdateAvailable(false);
  };

  // Check for updates on mount, visibility change, and periodically
  useEffect(() => {
    console.log('[UPDATE] Initializing update checker...');
    
    // Initial check on mount
    checkForUpdate(false, 'mount');

    // Periodic polling every 30 seconds
    const pollInterval = setInterval(() => {
      checkForUpdate(false, 'interval');
    }, POLL_INTERVAL_MS);
    
    console.log(`[UPDATE] Polling interval set: ${POLL_INTERVAL_MS / 1000}s`);

    // Check when app returns to foreground (iOS PWA resume)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[UPDATE] App became visible');
        checkForUpdate(false, 'visibility');
      }
    };

    // Check on focus (additional safety for iOS)
    const handleFocus = () => {
      checkForUpdate(false, 'focus');
    };

    // Check on page show (handles bfcache)
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('[UPDATE] Page restored from bfcache');
        checkForUpdate(false, 'pageshow');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      clearInterval(pollInterval);
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
