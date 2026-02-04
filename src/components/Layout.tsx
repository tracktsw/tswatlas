import { useEffect, useMemo, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import { ReminderBanner } from './ReminderBanner';
import { useCheckInReminder } from '@/hooks/useCheckInReminder';
import { useUserData } from '@/contexts/UserDataContext';
import { useLayout } from '@/contexts/LayoutContext';
import { useIOSKeyboardContext } from '@/contexts/IOSKeyboardContext';
import { initNotificationListeners, scheduleCheckInReminders } from '@/utils/notificationScheduler';
import { initBeliefNotifications, markAppOpenedToday } from '@/utils/beliefNotificationScheduler';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { cn } from '@/lib/utils';

const Layout = () => {
  const { hideBottomNav } = useLayout();
  const { reminderSettings, checkIns, userId, isLoading } = useUserData();
  const { isKeyboardOpen, isIOS } = useIOSKeyboardContext();
  const navigate = useNavigate();

  const isAndroid = useMemo(() => Capacitor.getPlatform() === 'android', []);

  const { shouldShowReminder, reminderType, dismissReminder, snoozeReminder } = useCheckInReminder({
    reminderSettings,
    checkIns,
    userId,
  });

  // Ensure notifications are scheduled when permission is granted and settings are enabled
  const ensureNotificationsScheduled = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || !userId || isLoading) return;
    if (!reminderSettings.enabled) return;

    try {
      const permResult = await LocalNotifications.checkPermissions();
      if (permResult.display === 'granted') {
        // Check if we have pending notifications
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length === 0) {
          console.log('[Layout] No pending notifications, scheduling...');
          await scheduleCheckInReminders(reminderSettings.reminderTime, true);
        }
      }
    } catch (error) {
      console.error('[Layout] Error ensuring notifications:', error);
    }
  }, [userId, isLoading, reminderSettings.enabled, reminderSettings.reminderTime]);

  // Initialize notification listeners for check-in reminders
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const cleanup = initNotificationListeners((route) => {
      navigate(route);
    });

    return cleanup;
  }, [navigate]);

  // Initialize belief reinforcement notifications
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | undefined;

    const init = async () => {
      cleanup = await initBeliefNotifications();
    };

    init();

    // Also mark app opened when coming to foreground
    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        markAppOpenedToday();
      }
    });

    return () => {
      if (cleanup) cleanup();
      listener.then(l => l.remove());
    };
  }, []);

  // Schedule notifications when settings change
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !userId || isLoading) return;

    if (reminderSettings.reminderTime) {
      scheduleCheckInReminders(
        reminderSettings.reminderTime,
        reminderSettings.enabled
      );
    }
  }, [reminderSettings, userId, isLoading]);

  // Re-check and schedule when app comes to foreground
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Check on mount
    ensureNotificationsScheduled();

    // Also when app comes to foreground
    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        ensureNotificationsScheduled();
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [ensureNotificationsScheduled]);

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {!isLoading && shouldShowReminder && reminderType && (
        <ReminderBanner
          reminderType={reminderType}
          onDismiss={dismissReminder}
          onSnooze={snoozeReminder}
        />
      )}

      <main
        className={cn(
          'flex-1 min-h-0 overscroll-contain',
          isIOS && isKeyboardOpen ? 'overflow-hidden' : 'overflow-y-auto',

          // iOS unchanged: still needs room for FIXED BottomNav
          !hideBottomNav && !isAndroid && 'pb-20',

          // Android: BottomNav is NOT fixed anymore, so no padding needed
          !hideBottomNav && isAndroid && 'pb-0'
        )}
      >
        <Outlet />
      </main>

      {!hideBottomNav && <BottomNav />}
    </div>
  );
};

export default Layout;
