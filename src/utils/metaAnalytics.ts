/**
 * Meta (Facebook) App Events for product usage tracking.
 * Uses the native Facebook SDK via Capacitor bridge.
 * 
 * Events tracked:
 * - onboarding_complete: Fired once when user finishes onboarding (signup)
 * - checkin_completed: Fired when user completes a symptom check-in
 * 
 * NOTE: Purchase/subscription events are handled by RevenueCat server-side.
 */

import { Capacitor } from '@capacitor/core';

// Storage key to prevent duplicate onboarding events
const ONBOARDING_EVENT_SENT_KEY = 'meta_onboarding_complete_sent';

/**
 * Check if we're running on a native platform with Meta SDK available.
 */
function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Log an event to Meta (Facebook) via native SDK.
 * On web, this is a no-op since Meta SDK is only on native.
 */
function logMetaEvent(eventName: string, parameters?: Record<string, string | number>): void {
  if (!isNativePlatform()) {
    console.log(`[Meta] Skipping event (web): ${eventName}`, parameters);
    return;
  }

  try {
    // Use the native bridge to call the Facebook SDK
    // The native code in AppDelegate.swift / MainActivity.java handles this
    if (Capacitor.getPlatform() === 'ios') {
      // iOS: Use WebKit message handler or evaluate JS bridge
      // The Facebook SDK on iOS auto-logs app events, but we need custom events
      (window as any).webkit?.messageHandlers?.metaEvent?.postMessage({
        eventName,
        parameters: parameters || {},
      });
    } else if (Capacitor.getPlatform() === 'android') {
      // Android: Use the Android bridge
      (window as any).MetaAnalytics?.logEvent(eventName, JSON.stringify(parameters || {}));
    }
    
    console.log(`[Meta] Event logged: ${eventName}`, parameters);
  } catch (error) {
    console.error(`[Meta] Failed to log event ${eventName}:`, error);
  }
}

/**
 * Track onboarding completion.
 * Called once after successful signup - uses localStorage to prevent duplicates.
 */
export function trackMetaOnboardingComplete(): void {
  // Prevent duplicate events
  if (localStorage.getItem(ONBOARDING_EVENT_SENT_KEY) === 'true') {
    console.log('[Meta] onboarding_complete already sent, skipping');
    return;
  }

  logMetaEvent('onboarding_complete');
  
  // Mark as sent to prevent future duplicates
  localStorage.setItem(ONBOARDING_EVENT_SENT_KEY, 'true');
}

/**
 * Track check-in completion.
 * Called after a successful symptom check-in is saved to the database.
 */
export function trackMetaCheckInCompleted(): void {
  logMetaEvent('checkin_completed');
}
