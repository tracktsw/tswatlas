import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import { ReminderBanner } from './ReminderBanner';
import { useCheckInReminder } from '@/hooks/useCheckInReminder';
import { useUserData } from '@/contexts/UserDataContext';
import { useLayout } from '@/contexts/LayoutContext';
import { useIOSKeyboardContext } from '@/contexts/IOSKeyboardContext';
import { cn } from '@/lib/utils';

const Layout = () => {
  const { hideBottomNav } = useLayout();
  const { reminderSettings, checkIns, userId, isLoading } = useUserData();
  const { isKeyboardOpen, isIOS } = useIOSKeyboardContext();

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

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ paddingTop: 'var(--safe-top)' }}>
      {/* Reminder banner - shows when due and user hasn't checked in */}
      {!isLoading && shouldShowReminder && reminderType && (
        <ReminderBanner
          reminderType={reminderType}
          onDismiss={dismissReminder}
          onSnooze={snoozeReminder}
        />
      )}
      
      <main className={cn(
        "flex-1",
        !hideBottomNav && "pb-20",
        // On iOS when keyboard is open OR text input is focused, prevent this container from scrolling to stop page jump
        isIOS && isKeyboardOpen ? "overflow-hidden" : "overflow-y-auto"
      )}>
        <Outlet />
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
};

export default Layout;
