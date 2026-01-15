import { useEffect, useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import { ReminderBanner } from './ReminderBanner';
import { useCheckInReminder } from '@/hooks/useCheckInReminder';
import { useUserData } from '@/contexts/UserDataContext';
import { useLayout } from '@/contexts/LayoutContext';
import { useIOSKeyboardContext } from '@/contexts/IOSKeyboardContext';
import { initNotificationListeners, scheduleCheckInReminders } from '@/utils/notificationScheduler';
import { Capacitor } from '@capacitor/core';
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

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const cleanup = initNotificationListeners((route) => {
      navigate(route);
    });

    return cleanup;
  }, [navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !userId || isLoading) return;

    if (reminderSettings.reminderTime) {
      scheduleCheckInReminders(
        reminderSettings.reminderTime,
        reminderSettings.enabled
      );
    }
  }, [reminderSettings, userId, isLoading]);

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
