import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import BottomNav from './BottomNav';
import { ReminderBanner } from './ReminderBanner';
import { useCheckInReminder } from '@/hooks/useCheckInReminder';
import { useUserData } from '@/contexts/UserDataContext';
import { useLayout } from '@/contexts/LayoutContext';

// Temporary debug component - REMOVE after fixing iOS layout
const DebugOverlay = () => {
  const [viewportInfo, setViewportInfo] = useState({ innerHeight: 0, clientHeight: 0 });
  
  useEffect(() => {
    const update = () => {
      setViewportInfo({
        innerHeight: window.innerHeight,
        clientHeight: document.documentElement.clientHeight,
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div className="fixed top-[env(safe-area-inset-top,0px)] left-0 z-[9999] bg-black/80 text-white text-[10px] p-2 font-mono max-w-[200px]">
      <div className="font-bold text-yellow-400">BUILD: 2026-01-02 15:00</div>
      <div className="mt-1 space-y-0.5">
        <div>innerH: {viewportInfo.innerHeight}px</div>
        <div>clientH: {viewportInfo.clientHeight}px</div>
        <div className="pt-[env(safe-area-inset-top,0px)]" style={{ background: 'rgba(255,0,0,0.3)' }}>
          ↑ safe-top padding
        </div>
        <div className="pb-[env(safe-area-inset-bottom,0px)]" style={{ background: 'rgba(0,255,0,0.3)' }}>
          ↓ safe-bottom padding
        </div>
      </div>
    </div>
  );
};

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
    <div className="min-h-screen bg-background flex flex-col pt-[env(safe-area-inset-top,0px)]">
      {/* DEBUG OVERLAY - REMOVE AFTER FIXING iOS */}
      <DebugOverlay />
      
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
