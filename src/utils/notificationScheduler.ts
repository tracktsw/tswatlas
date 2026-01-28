import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ScheduleOn } from '@capacitor/local-notifications';

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
 * Schedule daily check-in reminder notification.
 * Call this when reminder settings change.
 * 
 * Uses ScheduleOn with repeats:true for reliable daily scheduling on both iOS and Android.
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

    // Check permission first
    const permResult = await LocalNotifications.checkPermissions();
    if (permResult.display !== 'granted') {
      console.log('[NOTIFICATIONS] Permission not granted, cannot schedule');
      return false;
    }

    const time = parseTime(reminderTime);
    
    console.log('[NOTIFICATIONS] Scheduling daily notification:');
    console.log(`  Time: ${time.hour}:${time.minute}`);

    // Use ScheduleOn for reliable daily repeating notifications
    // This is the recommended approach for both iOS and Android
    const scheduleOn: ScheduleOn = {
      hour: time.hour,
      minute: time.minute,
    };

    await LocalNotifications.schedule({
      notifications: [
        {
          id: DAILY_NOTIFICATION_ID,
          title: 'Daily check-in ✨',
          body: 'How is your skin today? Take a moment to log your progress.',
          schedule: {
            on: scheduleOn,
            repeats: true,
            allowWhileIdle: true,
          },
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#6B8E7A',
          actionTypeId: 'CHECK_IN',
          extra: {
            route: '/check-in',
          },
        },
      ],
    });

    // Verify it was scheduled
    const pending = await LocalNotifications.getPending();
    console.log('[NOTIFICATIONS] Pending notifications:', pending.notifications.length);
    pending.notifications.forEach(n => {
      console.log(`  ID: ${n.id}, Title: ${n.title}`);
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
