import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Notification IDs
export const MORNING_NOTIFICATION_ID = 1;
export const EVENING_NOTIFICATION_ID = 2;

// Parse time string "HH:MM" to hours and minutes
function parseTime(timeStr: string): { hour: number; minute: number } {
  const [hourStr, minuteStr] = timeStr.split(':');
  return {
    hour: parseInt(hourStr, 10),
    minute: parseInt(minuteStr, 10),
  };
}

/**
 * Schedule check-in reminder notifications.
 * Call this when reminder settings change.
 */
export async function scheduleCheckInReminders(
  morningTime: string,
  eveningTime: string,
  enabled: boolean
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log('Not a native platform, skipping notification scheduling');
    return false;
  }

  try {
    // First, cancel existing reminders
    await LocalNotifications.cancel({
      notifications: [
        { id: MORNING_NOTIFICATION_ID },
        { id: EVENING_NOTIFICATION_ID },
      ],
    });

    if (!enabled) {
      console.log('Reminders disabled, cancelled all notifications');
      return true;
    }

    const morning = parseTime(morningTime);
    const evening = parseTime(eveningTime);

    // Schedule morning notification
    await LocalNotifications.schedule({
      notifications: [
        {
          id: MORNING_NOTIFICATION_ID,
          title: 'Good morning! ☀️',
          body: 'Time for your morning check-in. How are you feeling today?',
          schedule: {
            on: {
              hour: morning.hour,
              minute: morning.minute,
            },
            repeats: true,
            allowWhileIdle: true,
          },
          sound: 'default',
          actionTypeId: 'CHECK_IN',
          extra: {
            route: '/check-in',
            timeOfDay: 'morning',
          },
        },
        {
          id: EVENING_NOTIFICATION_ID,
          title: 'Evening check-in 🌙',
          body: 'How was your skin today? Take a moment to log your progress.',
          schedule: {
            on: {
              hour: evening.hour,
              minute: evening.minute,
            },
            repeats: true,
            allowWhileIdle: true,
          },
          sound: 'default',
          actionTypeId: 'CHECK_IN',
          extra: {
            route: '/check-in',
            timeOfDay: 'evening',
          },
        },
      ],
    });

    console.log(`Scheduled notifications: morning at ${morningTime}, evening at ${eveningTime}`);
    return true;
  } catch (error) {
    console.error('Error scheduling notifications:', error);
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
        { id: MORNING_NOTIFICATION_ID },
        { id: EVENING_NOTIFICATION_ID },
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
