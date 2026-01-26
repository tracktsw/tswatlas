import { useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

// Define the plugin interface
interface InAppReviewPlugin {
  requestReview(): Promise<{ requested: boolean }>;
  hasAlreadyRequested(): Promise<{ hasRequested: boolean }>;
}

// Register the native plugin
const InAppReview = registerPlugin<InAppReviewPlugin>('InAppReview');

// Storage key for web fallback (localStorage)
const STORAGE_KEY = 'hasRequestedInAppReview';
const CHECKIN_THRESHOLD = 7;

/**
 * Hook for requesting in-app reviews on iOS and Android.
 * 
 * iOS: Uses native StoreKit via Swift plugin (no npm dependencies)
 * Android: Uses Google Play In-App Review via Java plugin
 * Web: No-op (review prompts don't apply)
 * 
 * The review is requested only once per user, after 7 check-ins.
 */
export const useInAppReview = () => {
  const isNative = Capacitor.isNativePlatform();

  /**
   * Request an in-app review from the native platform.
   * Returns true if the request was made, false if already requested or failed.
   */
  const requestReview = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      console.log('[InAppReview] Not on native platform, skipping');
      return false;
    }

    try {
      const result = await InAppReview.requestReview();
      console.log('[InAppReview] Request result:', result.requested);
      return result.requested;
    } catch (error) {
      console.error('[InAppReview] Failed to request review:', error);
      return false;
    }
  }, [isNative]);

  /**
   * Check if a review has already been requested for this user.
   */
  const hasAlreadyRequested = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      // Web fallback: check localStorage
      return localStorage.getItem(STORAGE_KEY) === 'true';
    }

    try {
      const result = await InAppReview.hasAlreadyRequested();
      return result.hasRequested;
    } catch (error) {
      console.error('[InAppReview] Failed to check if already requested:', error);
      return false;
    }
  }, [isNative]);

  /**
   * Check if the review prompt should be shown based on check-in count.
   * Returns true only if:
   * - Running on native platform
   * - Check-in count is exactly 7
   * - Review hasn't been requested before
   */
  const shouldPromptForReview = useCallback(async (checkInCount: number): Promise<boolean> => {
    if (!isNative) {
      return false;
    }

    // Only trigger on exactly the 7th check-in
    if (checkInCount !== CHECKIN_THRESHOLD) {
      return false;
    }

    // Check if already requested
    const alreadyRequested = await hasAlreadyRequested();
    return !alreadyRequested;
  }, [isNative, hasAlreadyRequested]);

  /**
   * Attempt to request a review if the check-in count threshold is met.
   * Call this after a successful check-in save.
   */
  const maybeRequestReview = useCallback(async (checkInCount: number): Promise<void> => {
    const shouldPrompt = await shouldPromptForReview(checkInCount);
    
    if (shouldPrompt) {
      console.log('[InAppReview] Threshold met, requesting review');
      // Small delay to let the success UI render first
      setTimeout(async () => {
        await requestReview();
      }, 1500);
    }
  }, [shouldPromptForReview, requestReview]);

  return {
    requestReview,
    hasAlreadyRequested,
    shouldPromptForReview,
    maybeRequestReview,
    isNative,
    CHECKIN_THRESHOLD,
  };
};
