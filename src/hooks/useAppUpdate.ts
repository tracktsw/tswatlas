import { useState, useEffect } from "react";
import { APP_VERSION, VERSION_STORAGE_KEY } from "@/config/version";

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
    
    if (storedVersion && storedVersion !== APP_VERSION) {
      setUpdateAvailable(true);
    } else if (!storedVersion) {
      // First time user - store current version
      localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
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

      // Update stored version
      localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);

      // Force reload - bypass cache
      window.location.reload();
    } catch (error) {
      console.error("Update failed:", error);
      // Still try to reload even if cache clear fails
      window.location.reload();
    }
  };

  return {
    updateAvailable,
    isUpdating,
    performUpdate,
    currentVersion: APP_VERSION,
  };
}
