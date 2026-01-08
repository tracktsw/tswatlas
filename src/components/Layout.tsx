import { useEffect } from 'react';
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
  const { isKeyboardOpen, isIOS, isAndroid } = useIOSKeyboardContext();
  const navigate = useNavigate();
  const platform = Capacitor.getPlatform();

  const {
    shouldShowReminder,
    reminderType,
    dismissReminder,
    snoozeReminder,
  } = useCheckInReminder({
    reminderSettings,
    checkIns,
    userId,
  });

  // Initialize notification listeners on native platforms
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const cleanup = initNotificationListeners((route) => {
      navigate(route);
    });

    return cleanup;
  }, [navigate]);

  // Schedule notifications when reminder settings change (on native)
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !userId || isLoading) return;

    if (reminderSettings.morningTime && reminderSettings.eveningTime) {
      scheduleCheckInReminders(
        reminderSettings.morningTime,
        reminderSettings.eveningTime,
        reminderSettings.enabled
      );
    }
  }, [reminderSettings, userId, isLoading]);

  return (
    <div 
      className={cn(
        "h-[100dvh] bg-background flex flex-col overflow-hidden"
      )}
      style={
        platform === 'ios' 
          ? { paddingTop: 'var(--safe-top,0px)', paddingBottom: 'var(--safe-bottom,0px)' }
          : undefined
      }
    >
      {/* Reminder banner - shows when due and user hasn't checked in */}
      {!isLoading && shouldShowReminder && reminderType && (
        <ReminderBanner
          reminderType={reminderType}
          onDismiss={dismissReminder}
          onSnooze={snoozeReminder}
        />
      )}
      
      <main className={cn(
        "flex-1 min-h-0 overscroll-contain",
        !hideBottomNav && "pb-20",
        // On iOS when keyboard is open, prevent scrolling to stop page jump
        isIOS && isKeyboardOpen ? "overflow-hidden" : "overflow-y-auto"
      )}>
        <Outlet />
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
};

export default Layout;