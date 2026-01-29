import { useCallback, useState, useRef, useEffect } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications, ScheduleOn, Channel } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';

const PERMISSION_REQUESTED_KEY = 'notif_permission_requested_v2';

// Register Android-only ReminderPlugin for WorkManager-based scheduling
interface ReminderPluginInterface {
  scheduleReminder(options: { hour: number; minute: number }): Promise<{ success: boolean }>;
  cancelReminder(): Promise<{ success: boolean }>;
  isReminderEnabled(): Promise<{ enabled: boolean }>;
  getReminderTime(): Promise<{ hasTime: boolean; hour?: number; minute?: number }>;
}

const ReminderPlugin = registerPlugin<ReminderPluginInterface>('ReminderPlugin');

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
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const requestingRef = useRef(false);
  const isNative = Capacitor.isNativePlatform();

  // Check current permission status (safe to call anytime - does not show prompt)
  const checkPermission = useCallback(async (): Promise<NotificationPermissionStatus> => {
    if (!isNative) {
      return { granted: false, denied: false, prompt: false };
    }

    try {
      const result = await LocalNotifications.checkPermissions();
      console.log('[Notifications] Permission check result:', result.display);
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

  // Check permission on mount AND when app comes to foreground
  // This ensures the UI reflects current permission state (e.g., user enabled in Settings)
  useEffect(() => {
    if (!isNative) return;

    // Check on mount
    checkPermission();

    // Also check when app comes to foreground (user might have changed settings)
    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('[Notifications] App became active, checking permission');
        checkPermission();
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [isNative, checkPermission]);

  // Request permission - ONLY call from explicit user action (button tap)
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      return false;
    }

    // Guard: prevent multiple concurrent calls
    if (requestingRef.current) {
      console.log('[Notifications] Already requesting permission, skipping');
      return false;
    }

    // First check current status without showing a prompt
    const currentStatus = await checkPermission();
    
    // If already granted, return true without requesting again
    if (currentStatus.granted) {
      console.log('[Notifications] Permission already granted');
      return true;
    }
    
    // If already denied, return false without requesting again
    // User must go to device Settings to enable
    if (currentStatus.denied) {
      console.log('[Notifications] Permission was denied, user must enable in Settings');
      return false;
    }

    // Request permission
    try {
      requestingRef.current = true;
      setIsRequestingPermission(true);
      
      console.log('[Notifications] Requesting permission...');
      const result = await LocalNotifications.requestPermissions();
      console.log('[Notifications] Request result:', result.display);
      
      // Mark that we've requested
      localStorage.setItem(PERMISSION_REQUESTED_KEY, '1');
      
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
    } finally {
      requestingRef.current = false;
      setIsRequestingPermission(false);
    }
  }, [isNative, checkPermission]);

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
      // Ensure Android channel exists for test notifications too
      if (Capacitor.getPlatform() === 'android') {
        const channel: Channel = {
          id: 'tsw_reminders',
          name: 'Daily Reminders',
          description: 'Daily check-in reminder notifications',
          importance: 5, // HIGH - enables heads-up notifications
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: '#6B8E7A',
        };
        await LocalNotifications.createChannel(channel);
      }

      await LocalNotifications.schedule({
        notifications: [{
          id: 99999,
          title: 'Test Notification 🎉',
          body: 'Local notifications are working! Your app logo should appear.',
          schedule: {
            at: new Date(Date.now() + 5000),
          },
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          largeIcon: 'ic_launcher',
          iconColor: '#6B8E7A',
          channelId: 'tsw_reminders',
          autoCancel: true,
        }],
      });
      return true;
    } catch (error) {
      console.error('Error scheduling test notification:', error);
      return false;
    }
  }, [isNative]);

  // Note: We intentionally do NOT check permission on mount to avoid
  // triggering iOS permission dialogs unexpectedly. Permission should
  // only be checked/requested via explicit user action.

  return {
    isNative,
    permissionStatus,
    isRequestingPermission,
    checkPermission,
    requestPermission,
    scheduleReminder,
    cancelReminders,
    cancelAllReminders,
    getPendingNotifications,
    scheduleTestNotification,
  };
}
