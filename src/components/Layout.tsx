import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import { ReminderBanner } from './ReminderBanner';
import { useCheckInReminder } from '@/hooks/useCheckInReminder';
import { useUserData } from '@/contexts/UserDataContext';
import { useLayout } from '@/contexts/LayoutContext';

const Layout = () => {
  const { hideBottomNav } = useLayout();
  const { reminderSettings, checkIns, userId, isLoading } = useUserData();

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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Reminder banner - shows when due and user hasn't checked in */}
      {!isLoading && shouldShowReminder && reminderType && (
        <ReminderBanner
          reminderType={reminderType}
          onDismiss={dismissReminder}
          onSnooze={snoozeReminder}
        />
      )}
      
      <main className={hideBottomNav ? "flex-1 overflow-y-auto" : "flex-1 pb-20 overflow-y-auto"}>
        <Outlet />
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
};

export default Layout;
