import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Bell, Clock, Shield, Info, UserCog, LogOut, Cloud, Loader2, Moon, Sun, RefreshCw, CalendarClock, Mail, Eye, Smartphone, RotateCcw, AlertCircle, Sparkles } from 'lucide-react';
import { usePlatform } from '@/hooks/usePlatform';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useUserData } from '@/contexts/UserDataContext';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import SubscriptionCard from '@/components/SubscriptionCard';
import { useSubscription } from '@/hooks/useSubscription';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { useCheckInReminder } from '@/hooks/useCheckInReminder';
import { useLocalNotifications } from '@/hooks/useLocalNotifications';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { scheduleCheckInReminders } from '@/utils/notificationScheduler';
import { scheduleTestBeliefNotification } from '@/utils/beliefNotificationScheduler';
import { format } from 'date-fns';

const SettingsPage = () => {
  const { reminderSettings, updateReminderSettings, photos, checkIns, journalEntries, isLoading, isSyncing, userId } = useUserData();
  const { isAdmin, refreshSubscription } = useSubscription();
  const { isDemoMode, isAdmin: isDemoAdmin, toggleDemoMode } = useDemoMode();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentVersion, isChecking, checkForUpdate, performUpdate, updateAvailable } = useAppUpdate();
  const { isNative, permissionStatus, isRequestingPermission, checkPermission, requestPermission, scheduleTestNotification } = useLocalNotifications();
  const { isAndroid } = usePlatform();
  const { selectionChanged, notification } = useHapticFeedback();
  
  // Get next reminder time for display
  const { nextReminderTime } = useCheckInReminder({
    reminderSettings,
    checkIns,
    userId,
  });

  const handleCheckForUpdates = async () => {
    const hasUpdate = await checkForUpdate(true);
    if (hasUpdate) {
      toast.success('New version available! Tap to update.');
    } else {
      toast.success('You are on the latest version.');
    }
  };

  // Handle subscription success/cancel from Stripe redirect
  useEffect(() => {
    const subscriptionStatus = searchParams.get('subscription');
    if (subscriptionStatus === 'success') {
      toast.success('Subscription activated! Welcome to Premium.');
      refreshSubscription();
      // Clean up URL
      window.history.replaceState({}, '', '/settings');
    } else if (subscriptionStatus === 'cancelled') {
      toast.info('Subscription checkout was cancelled.');
      window.history.replaceState({}, '', '/settings');
    }
  }, [searchParams, refreshSubscription]);

  const handleToggleReminders = async (enabled: boolean) => {
    // Haptic feedback on toggle
    selectionChanged();
    
    try {
      // If disabling, just disable
      if (!enabled) {
        await updateReminderSettings({ ...reminderSettings, enabled: false });
        if (isNative) {
          await scheduleCheckInReminders(
            reminderSettings.reminderTime,
            false
          );
        }
        toast.success('Reminders disabled');
        return;
      }

      // If enabling on native, check permission status first (without requesting)
      if (isNative) {
        const status = await checkPermission();
        
        if (status.denied) {
          toast.error('Notifications are disabled. Please enable them in your device Settings.');
          return;
        }
        
        // If prompt, still enable reminders so the "Enable Notifications" button becomes visible
        // but don't schedule native notifications yet
        if (status.prompt) {
          await updateReminderSettings({ ...reminderSettings, enabled: true });
          toast.info('Tap "Enable Notifications" below to receive push notifications.');
          return;
        }
        
        // status.granted - proceed to enable with notifications
      }

      await updateReminderSettings({ ...reminderSettings, enabled: true });
      
      // Schedule native notifications
      if (isNative) {
        await scheduleCheckInReminders(
          reminderSettings.reminderTime,
          true
        );
      }
      
      toast.success('Reminders enabled');
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  // Handler for the explicit "Enable Notifications" button - the ONLY place requestPermission is called
  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      // Schedule notifications now that permission is granted
      if (reminderSettings.enabled) {
        await scheduleCheckInReminders(
          reminderSettings.reminderTime,
          true
        );
      }
      toast.success('Notifications enabled!');
    } else if (permissionStatus.denied) {
      toast.error('Notifications denied. Please enable them in your device Settings.');
    }
  };

  const handleReminderTimeChange = async (time: string) => {
    try {
      await updateReminderSettings({ ...reminderSettings, reminderTime: time });
      
      // Reschedule native notifications
      if (isNative && reminderSettings.enabled) {
        await scheduleCheckInReminders(time, true);
      }
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const handleTestNotification = async () => {
    const success = await scheduleTestNotification();
    if (success) {
      toast.success('Test notification scheduled! It will appear in 5 seconds.');
    } else {
      toast.error('Failed to schedule test notification');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out successfully');
    navigate('/auth');
  };

  // Hidden debug feature: long-press version to reset onboarding
  const [versionTapCount, setVersionTapCount] = useState(0);
  const [showResetOnboarding, setShowResetOnboarding] = useState(false);

  const handleVersionTap = useCallback(() => {
    setVersionTapCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 5) {
        setShowResetOnboarding(true);
        toast.info('Debug options unlocked');
        return 0;
      }
      return newCount;
    });
    // Reset count after 2 seconds of no taps
    setTimeout(() => setVersionTapCount(0), 2000);
  }, []);

  const handleResetOnboarding = () => {
    localStorage.removeItem('hasSeenOnboarding');
    localStorage.removeItem('onboardingData');
    toast.success('Onboarding reset! Sign out and back in to see it.');
    setShowResetOnboarding(false);
  };

  const handleTestBeliefNotification = async () => {
    const result = await scheduleTestBeliefNotification();
    if (result.success) {
      toast.success(`Test belief notification scheduled! "${result.message}" will appear in 5 seconds.`);
    } else {
      toast.error(`Failed: ${result.message}`);
    }
  };

  return (
    <div className="px-4 pt-6 safe-area-inset-top space-y-6 max-w-lg mx-auto mb-16">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link 
          to="/" 
          className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors duration-150 touch-manipulation active:scale-[0.96]"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Customize your experience</p>
        </div>
      </div>

      {/* All the content cards remain the same... */}
      <SubscriptionCard />

      <div className="glass-card p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            {theme === 'dark' ? (
              <Moon className="w-5 h-5 text-primary" />
            ) : (
              <Sun className="w-5 h-5 text-primary" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Night Mode</h3>
            <p className="text-sm text-muted-foreground">Easier on your eyes in the dark</p>
          </div>
          <Switch 
            checked={theme === 'dark'}
            onCheckedChange={(checked) => {
              selectionChanged();
              setTheme(checked ? 'dark' : 'light');
              toast.success(checked ? 'Night mode enabled' : 'Light mode enabled');
            }}
          />
        </div>
      </div>

      <div className="glass-card p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Daily Reminder</h3>
            <p className="text-sm text-muted-foreground">Get reminded to check in</p>
          </div>
          <Switch 
            checked={reminderSettings.enabled}
            onCheckedChange={handleToggleReminders}
          />
        </div>

        {reminderSettings.enabled && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Reminder time</span>
              </div>
              <Input 
                type="time"
                value={reminderSettings.reminderTime}
                onChange={(e) => handleReminderTimeChange(e.target.value)}
                className="w-28"
              />
            </div>
            
            {nextReminderTime && (
              <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg">
                <CalendarClock className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground">
                  Next reminder: <span className="font-medium">{format(nextReminderTime, 'EEE, MMM d \'at\' h:mm a')}</span>
                </span>
              </div>
            )}
            
            {isNative && (
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    Push notifications: {permissionStatus.granted ? (
                      <span className="text-green-600 dark:text-green-400">Enabled</span>
                    ) : permissionStatus.denied ? (
                      <span className="text-red-600 dark:text-red-400">Denied</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">Not enabled</span>
                    )}
                  </span>
                </div>
                {permissionStatus.prompt && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleEnableNotifications}
                    disabled={isRequestingPermission}
                  >
                    {isRequestingPermission ? 'Enabling...' : 'Enable Notifications'}
                  </Button>
                )}
                {permissionStatus.denied && (
                  <span className="text-xs text-muted-foreground">Open device Settings</span>
                )}
              </div>
            )}

            {isNative && permissionStatus.granted && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleTestNotification}
                className="w-full"
              >
                <Bell className="w-4 h-4 mr-2" />
                Send Test Notification
              </Button>
            )}
            
            <p className="text-xs text-muted-foreground">
              {isNative 
                ? 'You\'ll receive a push notification at your scheduled time.'
                : 'Reminder appears when you open the app after the scheduled time.'}
            </p>
            
            {isAndroid && (
              <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Due to Android battery optimization, notifications may occasionally be delayed by a few minutes.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="glass-card p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Cloud className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">Cloud Sync</h3>
              {isSyncing && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Your data is securely synced to the cloud. Log in on any device to access your progress.
            </p>
          </div>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-sage-light">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Your Privacy</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your data is encrypted and only accessible by you.
              Only your anonymous treatment votes are shared with the community.
            </p>
          </div>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-full bg-muted">
            <Info className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Your Data</h3>
            <p className="text-sm text-muted-foreground">Synced across all your devices</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-muted/50 rounded-xl">
            <p className="text-xl font-bold text-primary">{photos.length}</p>
            <p className="text-xs text-muted-foreground">Photos</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-xl">
            <p className="text-xl font-bold text-primary">{checkIns.length}</p>
            <p className="text-xs text-muted-foreground">Check-ins</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-xl">
            <p className="text-xl font-bold text-primary">{journalEntries.length}</p>
            <p className="text-xs text-muted-foreground">Journal</p>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="glass-card p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <UserCog className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Admin Panel</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Review and approve treatment suggestions from the community.
              </p>
              <Link to="/admin">
                <Button variant="outline" size="sm" className="mt-3">
                  Open Admin Panel
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {isDemoAdmin && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-500/10">
              <Eye className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Demo Mode</h3>
              <p className="text-sm text-muted-foreground">Insights preview only - edit past data for demos</p>
            </div>
            <Switch 
              checked={isDemoMode}
              onCheckedChange={() => {
                toggleDemoMode();
                toast.success(isDemoMode ? 'Demo Mode disabled' : 'Demo Mode enabled');
              }}
            />
          </div>
          {isDemoMode && (
            <p className="text-xs text-amber-500 mt-2 pl-12">
              Demo data is in-memory only and will reset on refresh.
            </p>
          )}
        </div>
      )}

      <div 
        className="glass-card p-4 cursor-pointer select-none"
        onClick={handleVersionTap}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <RefreshCw className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Version</h3>
            <p className="text-sm text-muted-foreground mt-1 font-mono">
              {currentVersion}
            </p>
          </div>
        </div>
      </div>

      {showResetOnboarding && (
        <>
          <div className="glass-card p-4 border-amber-500/50">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-amber-500/10">
                <RotateCcw className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Debug: Reset Onboarding</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Clear onboarding state to test the flow again.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3 border-amber-500/50 text-amber-600"
                  onClick={handleResetOnboarding}
                >
                  Reset Onboarding
                </Button>
              </div>
            </div>
          </div>

          <div className="glass-card p-4 border-amber-500/50">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-amber-500/10">
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Debug: Belief Notification</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Test the daily belief reinforcement notification system.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3 border-amber-500/50 text-amber-600"
                  onClick={handleTestBeliefNotification}
                  disabled={!isNative}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {isNative ? 'Send Test Belief Notification' : 'Native only'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="glass-card p-4">
        <h3 className="font-semibold text-foreground mb-2">About TrackTSW</h3>
        <p className="text-sm text-muted-foreground">
          A privacy-focused app to help you track your Topical Steroid Withdrawal journey. 
          Remember: healing is not linear, and every day you're getting closer to healthy skin.
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          Version {currentVersion} • Made with care
        </p>
      </div>

      <a 
        href="mailto:contact@tracktsw.app" 
        className="glass-card p-4 block hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Contact Us</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Questions, feedback, or feature requests? We'd love to hear from you.
            </p>
            <p className="text-xs text-primary mt-2">contact@tracktsw.app</p>
          </div>
        </div>
      </a>

      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={handleLogout}
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </Button>
    </div>
  );
};

export default SettingsPage;
