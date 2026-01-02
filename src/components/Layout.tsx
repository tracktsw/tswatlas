import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import BottomNav from './BottomNav';
import { ReminderBanner } from './ReminderBanner';
import { useCheckInReminder } from '@/hooks/useCheckInReminder';
import { useUserData } from '@/contexts/UserDataContext';
import { useLayout } from '@/contexts/LayoutContext';

// Temporary debug component - REMOVE after fixing iOS layout
const DebugOverlay = () => {
  const [info, setInfo] = useState({
    innerHeight: 0,
    safeTop: '0px',
    safeBottom: '0px',
    vvOffsetTop: 0,
    isNative: false,
  });
  
  useEffect(() => {
    const update = () => {
      const root = document.documentElement;
      const vv = window.visualViewport;
      setInfo({
        innerHeight: window.innerHeight,
        safeTop: getComputedStyle(root).getPropertyValue('--safe-top') || '0px',
        safeBottom: getComputedStyle(root).getPropertyValue('--safe-bottom') || '0px',
        vvOffsetTop: vv?.offsetTop || 0,
        isNative: !!(window as any).Capacitor?.isNativePlatform?.(),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    // Re-check after a delay (status bar plugin may take time)
    setTimeout(update, 500);
    setTimeout(update, 1500);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div 
      className="fixed left-0 z-[9999] bg-black/90 text-white text-[10px] p-2 font-mono max-w-[220px]"
      style={{ top: 'var(--safe-top, 0px)' }}
    >
      <div className="font-bold text-yellow-400">BUILD: 2026-01-02 16:00</div>
      <div className="mt-1 space-y-0.5">
        <div>Native: {info.isNative ? '✅ YES' : '❌ NO'}</div>
        <div className="text-green-400">--safe-top: {info.safeTop}</div>
        <div className="text-green-400">--safe-bottom: {info.safeBottom}</div>
        <div>vv.offsetTop: {info.vvOffsetTop}px</div>
        <div>innerHeight: {info.innerHeight}px</div>
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
    <div className="min-h-screen bg-background flex flex-col" style={{ paddingTop: 'var(--safe-top, 0px)' }}>
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
      
      <main className={hideBottomNav ? "flex-1 flex flex-col overflow-hidden" : "flex-1 flex flex-col pb-20 overflow-hidden"}>
        <Outlet />
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
};

export default Layout;
