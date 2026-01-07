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

// Detect Android platform (native or web)
const isAndroid = Capacitor.getPlatform() === 'android' || 
  (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent));

/**
 * Layout - Main app layout wrapper
 * 
 * Safe area strategy (Option B):
 * - Content gets padding-bottom: var(--nav-height) - just the nav bar height
 * - BottomNav gets padding-bottom: var(--safe-bottom) - the system safe area
 * - This ensures safe area is applied ONCE, not doubled
 * 
 * Scroll handling:
 * - Uses min-h-0 on scroll container for proper flex shrinking
 * - Avoids height:100vh in favor of flex layouts
 * - No overflow:hidden on html/body/#root (handled in index.css)
 */
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

  // On Android, no top safe area padding (flush to top)
  // On iOS, use --safe-top from CSS env()
  const topPadding = useMemo(() => isAndroid ? '0px' : 'var(--safe-top)', []);

  return (
    <div 
      className="min-h-[100dvh] bg-background flex flex-col" 
      style={{ paddingTop: topPadding }}
    >
      {/* Reminder banner - shows when due and user hasn't checked in */}
      {!isLoading && shouldShowReminder && reminderType && (
        <ReminderBanner
          reminderType={reminderType}
          onDismiss={dismissReminder}
          onSnooze={snoozeReminder}
        />
      )}
      
      {/* 
        Main content area
        - Uses --nav-height for bottom padding (not safe area - that's in BottomNav)
        - min-h-0 enables proper flex shrinking for scroll
        - touch-action: pan-y for Android 16 WebView scroll compatibility
      */}
      <main 
        className={cn(
          "flex-1 min-h-0",
          // On iOS when keyboard is open, prevent scrolling to stop page jump
          isIOS && isKeyboardOpen ? "overflow-hidden" : "overflow-y-auto",
          // Reserve space for nav bar height only - safe area is in BottomNav
          !hideBottomNav && "pb-[var(--nav-height)]"
        )}
        style={{ 
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <Outlet />
      </main>
      
      {!hideBottomNav && <BottomNav />}
    </div>
  );
};

export default Layout;
