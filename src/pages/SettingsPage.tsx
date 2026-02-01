import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Bell, Clock, Shield, Info, UserCog, LogOut, Cloud, Loader2, Moon, Sun, RefreshCw, CalendarClock, Mail, Eye, Smartphone, RotateCcw, AlertCircle, Globe } from 'lucide-react';
import { usePlatform } from '@/hooks/usePlatform';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useUserData } from '@/contexts/UserDataContext';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import SubscriptionCard from '@/components/SubscriptionCard';
import { useSubscription } from '@/hooks/useSubscription';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { useCheckInReminder } from '@/hooks/useCheckInReminder';
import { useLocalNotifications } from '@/hooks/useLocalNotifications';
import { scheduleCheckInReminders } from '@/utils/notificationScheduler';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

const SettingsPage = () => {
  const { t } = useTranslation('settings');
  const { reminderSettings, updateReminderSettings, photos, checkIns, journalEntries, isLoading, isSyncing, userId } = useUserData();
  const { isAdmin, refreshSubscription } = useSubscription();
  const { isDemoMode, isAdmin: isDemoAdmin, toggleDemoMode } = useDemoMode();
  const { language, setLanguage, supportedLanguages, isLoading: isLanguageLoading } = useLanguage();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentVersion, isChecking, checkForUpdate, performUpdate, updateAvailable } = useAppUpdate();
  const { isNative, permissionStatus, isRequestingPermission, checkPermission, requestPermission, scheduleTestNotification } = useLocalNotifications();
  const { isAndroid } = usePlatform();
  
  // Get next reminder time for display
  const { nextReminderTime } = useCheckInReminder({
    reminderSettings,
    checkIns,
    userId,
  });

  const handleCheckForUpdates = async () => {
    const hasUpdate = await checkForUpdate(true);
    if (hasUpdate) {
      toast.success(t('updateAvailable'));
    } else {
      toast.success(t('upToDate'));
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
        toast.success(t('remindersDisabled'));
        return;
      }

      // If enabling on native, check permission status first (without requesting)
      if (isNative) {
        const status = await checkPermission();
        
        if (status.denied) {
            toast.error(t('notificationsDenied'));
          return;
        }
        
        // If prompt, still enable reminders so the "Enable Notifications" button becomes visible
        // but don't schedule native notifications yet
        if (status.prompt) {
          await updateReminderSettings({ ...reminderSettings, enabled: true });
            toast.info(t('tapEnableNotifications'));
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
      toast.error(t('failedToUpdateSettings'));
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
      toast.success(t('notificationsEnabled'));
    } else if (permissionStatus.denied) {
      toast.error(t('notificationsDenied'));
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
      toast.error(t('failedToUpdateSettings'));
    }
  };

  const handleTestNotification = async () => {
    const success = await scheduleTestNotification();
    if (success) {
      toast.success(t('testNotificationScheduled'));
    } else {
      toast.error(t('testNotificationFailed'));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success(t('signedOut'));
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
        toast.info(t('debugOptionsUnlocked'));
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
    toast.success(t('onboardingReset'));
    setShowResetOnboarding(false);
  };

  return (
    <div className="px-4 pt-6 safe-area-inset-top space-y-6 max-w-lg mx-auto mb-16">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link 
          to="/" 
          className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      {/* All the content cards remain the same... */}
      <SubscriptionCard />

      {/* Language Selector */}
      <div className="glass-card p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{t('language')}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t('languageDesc')}</p>
            <Select 
              value={language} 
              onValueChange={(value) => setLanguage(value as any)}
              disabled={isLanguageLoading}
            >
              <SelectTrigger className="w-full mt-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supportedLanguages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.nativeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

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
            <h3 className="font-semibold text-foreground">{t('nightMode')}</h3>
            <p className="text-sm text-muted-foreground">{t('nightModeDesc')}</p>
          </div>
          <Switch 
            checked={theme === 'dark'}
            onCheckedChange={(checked) => {
              setTheme(checked ? 'dark' : 'light');
              toast.success(checked ? t('nightModeEnabled') : t('lightModeEnabled'));
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
            <h3 className="font-semibold text-foreground">{t('dailyReminder')}</h3>
            <p className="text-sm text-muted-foreground">{t('dailyReminderDesc')}</p>
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
                <span className="text-sm">{t('reminderTime')}</span>
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
                  {t('nextReminder', { time: format(nextReminderTime, 'EEE, MMM d \'at\' h:mm a') })}
                </span>
              </div>
            )}
            
            {isNative && (
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {t('pushNotifications')}: {permissionStatus.granted ? (
                      <span className="text-green-600 dark:text-green-400">{t('enabled')}</span>
                    ) : permissionStatus.denied ? (
                      <span className="text-red-600 dark:text-red-400">{t('denied')}</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">{t('notEnabled')}</span>
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
                    {isRequestingPermission ? t('enablingNotifications') : t('enableNotifications')}
                  </Button>
                )}
                {permissionStatus.denied && (
                  <span className="text-xs text-muted-foreground">{t('openDeviceSettings')}</span>
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
                {t('sendTestNotification')}
              </Button>
            )}
            
            <p className="text-xs text-muted-foreground">
              {isNative ? t('reminderNativeDesc') : t('reminderWebDesc')}
            </p>
            
            {isAndroid && (
              <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {t('androidBatteryWarning')}
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
              <h3 className="font-semibold text-foreground">{t('cloudSync')}</h3>
              {isSyncing && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {t('cloudSyncDesc')}
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
            <h3 className="font-semibold text-foreground">{t('privacy')}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('privacyDesc')}
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
            <h3 className="font-semibold text-foreground">{t('yourData')}</h3>
            <p className="text-sm text-muted-foreground">{t('yourDataDesc')}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-muted/50 rounded-xl">
            <p className="text-xl font-bold text-primary">{photos.length}</p>
            <p className="text-xs text-muted-foreground">{t('photos', { defaultValue: 'Photos' })}</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-xl">
            <p className="text-xl font-bold text-primary">{checkIns.length}</p>
            <p className="text-xs text-muted-foreground">{t('checkIns', { defaultValue: 'Check-ins' })}</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-xl">
            <p className="text-xl font-bold text-primary">{journalEntries.length}</p>
            <p className="text-xs text-muted-foreground">{t('journal', { defaultValue: 'Journal' })}</p>
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
            <h3 className="font-semibold text-foreground">{t('adminPanel')}</h3>
              <p className="text-sm text-muted-foreground mt-1">
              {t('adminPanelDesc')}
              </p>
              <Link to="/admin">
              <Button variant="outline" size="sm" className="mt-3">
                {t('openAdminPanel')}
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
            <h3 className="font-semibold text-foreground">{t('demoMode')}</h3>
            <p className="text-sm text-muted-foreground">{t('demoModeDesc')}</p>
            </div>
            <Switch 
              checked={isDemoMode}
              onCheckedChange={() => {
                toggleDemoMode();
                toast.success(isDemoMode ? t('demoModeDisabled') : t('demoModeEnabled'));
              }}
            />
          </div>
          {isDemoMode && (
            <p className="text-xs text-amber-500 mt-2 pl-12">
              {t('demoModeNote')}
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
            <h3 className="font-semibold text-foreground">{t('version')}</h3>
            <p className="text-sm text-muted-foreground mt-1 font-mono">
              {currentVersion}
            </p>
          </div>
        </div>
      </div>

      {showResetOnboarding && (
        <div className="glass-card p-4 border-amber-500/50">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-amber-500/10">
              <RotateCcw className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{t('resetOnboarding')}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('resetOnboardingDesc')}
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 border-amber-500/50 text-amber-600"
                onClick={handleResetOnboarding}
              >
                {t('resetOnboardingButton')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card p-4">
        <h3 className="font-semibold text-foreground mb-2">{t('about')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('aboutDesc')}
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          {t('version')} {currentVersion} • {t('madeWithCare')}
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
            <h3 className="font-semibold text-foreground">{t('contactUs')}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('contactUsDesc')}
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
        {t('signOut')}
      </Button>
    </div>
  );
};

export default SettingsPage;
