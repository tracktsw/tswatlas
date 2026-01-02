import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ScheduleOn } from '@capacitor/local-notifications';

export interface NotificationPermissionStatus {
  granted: boolean;
  denied: boolean;
  prompt: boolean;
}

export function useLocalNotifications() {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus>({
    granted: false,
    denied: false,
    prompt: true,
  });
  const isNative = Capacitor.isNativePlatform();

  // Check current permission status
  const checkPermission = useCallback(async (): Promise<NotificationPermissionStatus> => {
    if (!isNative) {
      return { granted: false, denied: false, prompt: false };
    }

    try {
      const result = await LocalNotifications.checkPermissions();
      const status = {
        granted: result.display === 'granted',
        denied: result.display === 'denied',
        prompt: result.display === 'prompt' || result.display === 'prompt-with-rationale',
      };
      setPermissionStatus(status);
      return status;
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      return { granted: false, denied: false, prompt: false };
    }
  }, [isNative]);

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      return false;
    }

    try {
      const result = await LocalNotifications.requestPermissions();
      const granted = result.display === 'granted';
      setPermissionStatus({
        granted,
        denied: result.display === 'denied',
        prompt: false,
      });
      return granted;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }, [isNative]);

  // Schedule a daily repeating notification
  const scheduleReminder = useCallback(async (
    id: number,
    title: string,
    body: string,
    hour: number,
    minute: number
  ): Promise<boolean> => {
    if (!isNative) {
      return false;
    }

    try {
      // Cancel existing notification with this ID first
      await LocalNotifications.cancel({ notifications: [{ id }] });

      const scheduleOn: ScheduleOn = {
        hour,
        minute,
      };

      await LocalNotifications.schedule({
        notifications: [{
          id,
          title,
          body,
          schedule: {
            on: scheduleOn,
            repeats: true,
            allowWhileIdle: true,
          },
          sound: 'default',
          actionTypeId: 'CHECK_IN',
          extra: {
            route: '/check-in',
          },
        }],
      });

      return true;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return false;
    }
  }, [isNative]);

  // Cancel specific notifications
  const cancelReminders = useCallback(async (ids: number[]): Promise<boolean> => {
    if (!isNative) {
      return false;
    }

    try {
      await LocalNotifications.cancel({
        notifications: ids.map(id => ({ id })),
      });
      return true;
    } catch (error) {
      console.error('Error canceling notifications:', error);
      return false;
    }
  }, [isNative]);

  // Cancel all scheduled notifications
  const cancelAllReminders = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      return false;
    }

    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map(n => ({ id: n.id })),
        });
      }
      return true;
    } catch (error) {
      console.error('Error canceling all notifications:', error);
      return false;
    }
  }, [isNative]);

  // Get pending notifications
  const getPendingNotifications = useCallback(async () => {
    if (!isNative) {
      return [];
    }

    try {
      const pending = await LocalNotifications.getPending();
      return pending.notifications;
    } catch (error) {
      console.error('Error getting pending notifications:', error);
      return [];
    }
  }, [isNative]);

  // Schedule a test notification (fires in 5 seconds)
  const scheduleTestNotification = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      return false;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: 99999,
          title: 'Test Notification',
          body: 'Local notifications are working!',
          schedule: {
            at: new Date(Date.now() + 5000),
          },
          sound: 'default',
        }],
      });
      return true;
    } catch (error) {
      console.error('Error scheduling test notification:', error);
      return false;
    }
  }, [isNative]);

  // Check permission on mount
  useEffect(() => {
    if (isNative) {
      checkPermission();
    }
  }, [isNative, checkPermission]);

  return {
    isNative,
    permissionStatus,
    checkPermission,
    requestPermission,
    scheduleReminder,
    cancelReminders,
    cancelAllReminders,
    getPendingNotifications,
    scheduleTestNotification,
  };
}
