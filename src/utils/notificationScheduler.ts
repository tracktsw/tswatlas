import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Notification ID for daily reminder
export const DAILY_NOTIFICATION_ID = 1;

// Parse time string "HH:MM" to hours and minutes
function parseTime(timeStr: string): { hour: number; minute: number } {
  const [hourStr, minuteStr] = timeStr.split(':');
  return {
    hour: parseInt(hourStr, 10),
    minute: parseInt(minuteStr, 10),
  };
}

/**
 * Calculate the next fire date for a given hour and minute.
 * If the time has already passed today, schedule for tomorrow.
 */
function getNextFireDate(hour: number, minute: number): Date {
  const now = new Date();
  const fireDate = new Date();
  fireDate.setHours(hour, minute, 0, 0);

  // If the time has already passed today, schedule for tomorrow
  if (fireDate <= now) {
    fireDate.setDate(fireDate.getDate() + 1);
  }

  return fireDate;
}

/**
 * Schedule daily check-in reminder notification.
 * Call this when reminder settings change.
 */
export async function scheduleCheckInReminders(
  reminderTime: string,
  enabled: boolean
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[NOTIFICATIONS] Not a native platform, skipping notification scheduling');
    return false;
  }

  try {
    // First, cancel existing reminders
    await LocalNotifications.cancel({
      notifications: [
        { id: DAILY_NOTIFICATION_ID },
      ],
    });
    console.log('[NOTIFICATIONS] Cancelled existing reminders');

    if (!enabled) {
      console.log('[NOTIFICATIONS] Reminders disabled, not scheduling new ones');
      return true;
    }

    const time = parseTime(reminderTime);
    const fireDate = getNextFireDate(time.hour, time.minute);

    console.log('[NOTIFICATIONS] Scheduling daily notification:');
    console.log(`  Time: ${reminderTime} -> Next fire: ${fireDate.toLocaleString()}`);

    // Schedule with 'at' and 'every: day' for reliable daily scheduling
    await LocalNotifications.schedule({
      notifications: [
        {
          id: DAILY_NOTIFICATION_ID,
          title: 'Daily check-in ✨',
          body: 'How is your skin today? Take a moment to log your progress.',
          schedule: {
            at: fireDate,
            every: 'day',
            allowWhileIdle: true,
          },
          sound: 'default',
          actionTypeId: 'CHECK_IN',
          extra: {
            route: '/check-in',
          },
        },
      ],
    });

    console.log('[NOTIFICATIONS] Successfully scheduled daily reminder');
    return true;
  } catch (error) {
    console.error('[NOTIFICATIONS] Error scheduling notifications:', error);
    return false;
  }
}

/**
 * Cancel all check-in reminder notifications.
 */
export async function cancelAllCheckInReminders(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    await LocalNotifications.cancel({
      notifications: [
        { id: DAILY_NOTIFICATION_ID },
      ],
    });
    console.log('Cancelled all check-in reminders');
    return true;
  } catch (error) {
    console.error('Error cancelling notifications:', error);
    return false;
  }
}

/**
 * Initialize notification listeners for handling taps.
 * Returns a cleanup function.
 */
export function initNotificationListeners(
  onNotificationTap: (route: string, extras?: Record<string, unknown>) => void
): () => void {
  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }

  // Handle notification action (when user taps the notification)
  const actionListener = LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (notification) => {
      console.log('Notification action performed:', notification);
      const route = notification.notification.extra?.route as string || '/check-in';
      onNotificationTap(route, notification.notification.extra as Record<string, unknown>);
    }
  );

  // Return cleanup function
  return () => {
    actionListener.then(listener => listener.remove());
  };
}
