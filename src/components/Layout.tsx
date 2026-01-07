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

const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

const Layout = () => {
  const { hideBottomNav } = useLayout();
  const { reminderSettings, checkIns, userId, isLoading } = useUserData();
  const { isKeyboardOpen, isIOS } = useIOSKeyboardContext();
  const navigate = useNavigate();

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
      // Navigate to the route when notification is tapped
      navigate(route);
    });

    return cleanup;
  }, [navigate]);

  // Schedule notifications when reminder settings change (on native)
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !userId || isLoading) return;

    // Only schedule if we have valid settings
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
      className="h-[100dvh] bg-background flex flex-col overflow-hidden" 
      style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
    >
      {/* Reminder banner - shows when due and user hasn't checked in */}
      {!isLoading && shouldShowReminder && reminderType && (
        <ReminderBanner
          reminderType={reminderType}
          onDismiss={dismissReminder}
          onSnooze={snoozeReminder}
        />
      )}
      
      <main 
        className={cn(
          "flex-1 min-h-0 overscroll-contain",
          // On iOS when keyboard is open OR text input is focused, prevent this container from scrolling to stop page jump
          isIOS && isKeyboardOpen ? "overflow-hidden" : "overflow-y-auto",
          // Reserve space for BottomNav on web/iOS; Android uses explicit inset-aware padding below
          !isNativeAndroid && !hideBottomNav && "pb-20"
        )}
        style={
          isNativeAndroid && !hideBottomNav
            ? {
                paddingBottom:
                  'calc(5rem + max(env(safe-area-inset-bottom), var(--android-bottom-inset, 0px)))',
              }
            : undefined
        }
      >
        <Outlet />
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
};

export default Layout;
