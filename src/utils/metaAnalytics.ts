/**
 * Meta (Facebook) App Events for product usage tracking.
 * Uses the native Facebook SDK via Capacitor bridge.
 * 
 * Events tracked:
 * - onboarding_complete: Fired once when user finishes onboarding (signup)
 * - checkin_completed: Fired when user completes a symptom check-in
 * - StartTrial: Fired once when a free trial is successfully started
 * - Subscribe: Fired once when a paid subscription is activated
 * 
 * NOTE: Purchase/subscription events are handled by RevenueCat server-side.
 * The StartTrial and Subscribe events here supplement that for Meta Ads attribution.
 */

import { Capacitor } from '@capacitor/core';

// Storage keys to prevent duplicate events
const ONBOARDING_EVENT_SENT_KEY = 'meta_onboarding_complete_sent';
const START_TRIAL_SENT_KEY = 'meta_start_trial_sent';
const SUBSCRIBE_SENT_KEY = 'meta_subscribe_sent';

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

/**
 * Track free trial start.
 * Called once after RevenueCat confirms a trial is active.
 * Uses localStorage to prevent duplicates across app launches/restores.
 * 
 * @param userId - The user ID to associate the event with (prevents cross-user duplicates)
 */
export function trackMetaStartTrial(userId: string): void {
  const key = `${START_TRIAL_SENT_KEY}_${userId}`;
  
  // Prevent duplicate events for this user
  if (localStorage.getItem(key) === 'true') {
    console.log('[Meta] StartTrial already sent for user, skipping');
    return;
  }

  logMetaEvent('StartTrial');
  
  // Mark as sent for this user
  localStorage.setItem(key, 'true');
}

/**
 * Track paid subscription activation.
 * Called once after RevenueCat confirms a paid subscription is active (trial conversion or direct purchase).
 * Uses localStorage to prevent duplicates across app launches/restores.
 * 
 * @param userId - The user ID to associate the event with (prevents cross-user duplicates)
 * @param value - Optional: the subscription value/price for attribution
 * @param currency - Optional: currency code (e.g., 'USD', 'GBP')
 */
export function trackMetaSubscribe(userId: string, value?: number, currency?: string): void {
  const key = `${SUBSCRIBE_SENT_KEY}_${userId}`;
  
  // Prevent duplicate events for this user
  if (localStorage.getItem(key) === 'true') {
    console.log('[Meta] Subscribe already sent for user, skipping');
    return;
  }

  const params: Record<string, string | number> = {};
  if (value !== undefined) {
    params.value = value;
  }
  if (currency) {
    params.currency = currency;
  }

  logMetaEvent('Subscribe', Object.keys(params).length > 0 ? params : undefined);
  
  // Mark as sent for this user
  localStorage.setItem(key, 'true');
}
