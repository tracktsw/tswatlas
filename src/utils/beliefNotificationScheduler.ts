import { Capacitor } from '@capacitor/core';
import { LocalNotifications, Channel } from '@capacitor/local-notifications';
import { getBeliefMessageAvoidingRecent } from '@/constants/beliefMessages';

// Notification ID for belief reinforcement (different from check-in reminders)
export const BELIEF_NOTIFICATION_ID = 2;

// Android notification channel - separate from check-in reminders
const ANDROID_CHANNEL_ID = 'tsw_beliefs';

// Storage keys
const STORAGE_KEY_LAST_SHOWN_DATE = 'belief_notif_last_shown_date';
const STORAGE_KEY_RECENT_INDICES = 'belief_notif_recent_indices';
const STORAGE_KEY_LAST_APP_OPEN_DATE = 'belief_notif_last_app_open';
const STORAGE_KEY_ENABLED = 'belief_notif_enabled';
const STORAGE_KEY_WINDOW_START = 'belief_notif_window_start';
const STORAGE_KEY_WINDOW_END = 'belief_notif_window_end';

// Default time window (9am - 7pm)
const DEFAULT_WINDOW_START = 9; // 9am
const DEFAULT_WINDOW_END = 19; // 7pm

/**
 * Mark that the user opened the app today.
 * Call this when the app becomes active.
 */
export function markAppOpenedToday(): void {
  const today = new Date().toDateString();
  localStorage.setItem(STORAGE_KEY_LAST_APP_OPEN_DATE, today);
}

/**
 * Check if the user has already opened the app today.
 */
export function hasUserOpenedAppToday(): boolean {
  const lastOpen = localStorage.getItem(STORAGE_KEY_LAST_APP_OPEN_DATE);
  const today = new Date().toDateString();
  return lastOpen === today;
}

/**
 * Get the current belief notification settings.
 */
export function getBeliefNotificationSettings(): {
  enabled: boolean;
  windowStart: number;
  windowEnd: number;
} {
  const enabled = localStorage.getItem(STORAGE_KEY_ENABLED) !== 'false'; // Default to true
  const windowStart = parseInt(localStorage.getItem(STORAGE_KEY_WINDOW_START) || String(DEFAULT_WINDOW_START), 10);
  const windowEnd = parseInt(localStorage.getItem(STORAGE_KEY_WINDOW_END) || String(DEFAULT_WINDOW_END), 10);
  
  return { enabled, windowStart, windowEnd };
}

/**
 * Update belief notification settings.
 */
export function setBeliefNotificationSettings(settings: {
  enabled?: boolean;
  windowStart?: number;
  windowEnd?: number;
}): void {
  if (settings.enabled !== undefined) {
    localStorage.setItem(STORAGE_KEY_ENABLED, String(settings.enabled));
  }
  if (settings.windowStart !== undefined) {
    localStorage.setItem(STORAGE_KEY_WINDOW_START, String(settings.windowStart));
  }
  if (settings.windowEnd !== undefined) {
    localStorage.setItem(STORAGE_KEY_WINDOW_END, String(settings.windowEnd));
  }
}

/**
 * Get a random time within the configured window.
 * Returns { hour, minute } for the notification.
 */
function getRandomTimeInWindow(windowStart: number, windowEnd: number): { hour: number; minute: number } {
  // Random hour within window (inclusive start, exclusive end)
  const hourRange = windowEnd - windowStart;
  const randomHourOffset = Math.floor(Math.random() * hourRange);
  const hour = windowStart + randomHourOffset;
  
  // Random minute
  const minute = Math.floor(Math.random() * 60);
  
  return { hour, minute };
}

/**
 * Get the next message, avoiding recently shown ones.
 */
function getNextMessage(): { message: string; index: number } {
  const recentIndicesStr = localStorage.getItem(STORAGE_KEY_RECENT_INDICES);
  let recentIndices: number[] = [];
  
  try {
    recentIndices = recentIndicesStr ? JSON.parse(recentIndicesStr) : [];
  } catch {
    recentIndices = [];
  }
  
  const result = getBeliefMessageAvoidingRecent(recentIndices);
  
  // Update recent indices (keep last 5 to cycle through more variety)
  recentIndices.push(result.index);
  if (recentIndices.length > 5) {
    recentIndices = recentIndices.slice(-5);
  }
  localStorage.setItem(STORAGE_KEY_RECENT_INDICES, JSON.stringify(recentIndices));
  
  return result;
}

/**
 * Create Android notification channel for belief notifications.
 * Uses normal importance (not high) since these aren't urgent.
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') {
    return;
  }

  try {
    const channel: Channel = {
      id: ANDROID_CHANNEL_ID,
      name: 'Daily Insights',
      description: 'Daily educational insights about tracking patterns',
      importance: 3, // DEFAULT - no heads-up, but sound and notification
      visibility: 1, // PUBLIC
      vibration: false, // Less intrusive
      lights: true,
      lightColor: '#6B8E7A',
    };

    await LocalNotifications.createChannel(channel);
    console.log('[BELIEF NOTIFICATIONS] Android channel created');
  } catch (error) {
    console.error('[BELIEF NOTIFICATIONS] Error creating Android channel:', error);
  }
}

/**
 * Schedule the next belief notification.
 * Should be called:
 * - When app launches (to ensure one is scheduled)
 * - After a belief notification fires (to schedule the next one)
 * - When settings change
 */
export async function scheduleNextBeliefNotification(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[BELIEF NOTIFICATIONS] Not native platform, skipping');
    return false;
  }

  const settings = getBeliefNotificationSettings();
  
  // Cancel any existing belief notification first
  try {
    await LocalNotifications.cancel({ notifications: [{ id: BELIEF_NOTIFICATION_ID }] });
  } catch (error) {
    console.warn('[BELIEF NOTIFICATIONS] Error canceling existing:', error);
  }

  if (!settings.enabled) {
    console.log('[BELIEF NOTIFICATIONS] Disabled, not scheduling');
    return true;
  }

  // Check permission
  const permResult = await LocalNotifications.checkPermissions();
  if (permResult.display !== 'granted') {
    console.log('[BELIEF NOTIFICATIONS] Permission not granted');
    return false;
  }

  // Ensure Android channel exists
  await ensureAndroidChannel();

  // Get random time for tomorrow within window
  const { hour, minute } = getRandomTimeInWindow(settings.windowStart, settings.windowEnd);
  
  // Calculate the next occurrence (tomorrow at random time)
  const now = new Date();
  const scheduledDate = new Date();
  scheduledDate.setDate(now.getDate() + 1); // Tomorrow
  scheduledDate.setHours(hour, minute, 0, 0);
  
  // Get the message
  const { message } = getNextMessage();

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: BELIEF_NOTIFICATION_ID,
          title: 'TrackTSW',
          body: message,
          schedule: {
            at: scheduledDate,
            allowWhileIdle: true,
          },
          sound: 'default',
          channelId: ANDROID_CHANNEL_ID,
          // No actionTypeId or extra route - we don't want users to open the app
        },
      ],
    });

    console.log(`[BELIEF NOTIFICATIONS] Scheduled for ${scheduledDate.toLocaleString()}: "${message}"`);
    localStorage.setItem(STORAGE_KEY_LAST_SHOWN_DATE, now.toDateString());
    
    return true;
  } catch (error) {
    console.error('[BELIEF NOTIFICATIONS] Error scheduling:', error);
    return false;
  }
}

/**
 * Initialize belief notification system.
 * - Sets up listener for when notifications fire
 * - Schedules the next notification if needed
 * - Marks app as opened today
 */
export async function initBeliefNotifications(): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }

  // Mark that app was opened
  markAppOpenedToday();

  // Check if we need to cancel today's scheduled notification
  // (user already opened app, so suppress it)
  try {
    const pending = await LocalNotifications.getPending();
    const beliefNotif = pending.notifications.find(n => n.id === BELIEF_NOTIFICATION_ID);
    
    if (beliefNotif && beliefNotif.schedule?.at) {
      const scheduledDate = new Date(beliefNotif.schedule.at);
      const today = new Date();
      
      // If scheduled for today and user opened app, cancel it
      if (scheduledDate.toDateString() === today.toDateString()) {
        console.log('[BELIEF NOTIFICATIONS] Canceling today\'s notification (user opened app)');
        await LocalNotifications.cancel({ notifications: [{ id: BELIEF_NOTIFICATION_ID }] });
        // Schedule for tomorrow instead
        await scheduleNextBeliefNotification();
      }
    } else {
      // No notification scheduled, schedule one
      await scheduleNextBeliefNotification();
    }
  } catch (error) {
    console.error('[BELIEF NOTIFICATIONS] Error during init:', error);
  }

  // Set up listener for when belief notification fires
  const listener = LocalNotifications.addListener(
    'localNotificationReceived',
    async (notification) => {
      if (notification.id === BELIEF_NOTIFICATION_ID) {
        console.log('[BELIEF NOTIFICATIONS] Notification received, scheduling next');
        // Schedule the next one
        await scheduleNextBeliefNotification();
      }
    }
  );

  // Return cleanup function
  return () => {
    listener.then(l => l.remove());
  };
}

/**
 * Cancel all belief notifications.
 */
export async function cancelBeliefNotifications(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    await LocalNotifications.cancel({ notifications: [{ id: BELIEF_NOTIFICATION_ID }] });
    console.log('[BELIEF NOTIFICATIONS] Cancelled');
    return true;
  } catch (error) {
    console.error('[BELIEF NOTIFICATIONS] Error canceling:', error);
    return false;
  }
}
