import { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Clock, Shield, Info, UserCog, LogOut, Cloud, Loader2, Moon, Sun, RefreshCw, CalendarClock, Mail } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useUserData } from '@/contexts/UserDataContext';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import SubscriptionCard from '@/components/SubscriptionCard';
import { useSubscription } from '@/hooks/useSubscription';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { useCheckInReminder } from '@/hooks/useCheckInReminder';
import { format } from 'date-fns';
const SettingsPage = () => {
  const { reminderSettings, updateReminderSettings, photos, checkIns, journalEntries, isLoading, isSyncing, userId } = useUserData();
  const { isAdmin, refreshSubscription } = useSubscription();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentVersion, isChecking, checkForUpdate, performUpdate, updateAvailable } = useAppUpdate();
  
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
    try {
      await updateReminderSettings({ ...reminderSettings, enabled });
      toast.success(enabled ? 'Reminders enabled' : 'Reminders disabled');
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const handleMorningTimeChange = async (time: string) => {
    try {
      await updateReminderSettings({ ...reminderSettings, morningTime: time });
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const handleEveningTimeChange = async (time: string) => {
    try {
      await updateReminderSettings({ ...reminderSettings, eveningTime: time });
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out successfully');
    navigate('/auth');
  };

  return (
    <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link 
          to="/" 
          className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Customize your experience</p>
        </div>
      </div>

      {/* Subscription */}
      <SubscriptionCard />

      {/* Appearance */}
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
              setTheme(checked ? 'dark' : 'light');
              toast.success(checked ? 'Night mode enabled' : 'Light mode enabled');
            }}
          />
        </div>
      </div>

      {/* Reminders */}
      <div className="glass-card p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Reminders</h3>
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
                <span className="text-sm">Morning reminder</span>
              </div>
              <Input 
                type="time"
                value={reminderSettings.morningTime}
                onChange={(e) => handleMorningTimeChange(e.target.value)}
                className="w-28"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Evening reminder</span>
              </div>
              <Input 
                type="time"
                value={reminderSettings.eveningTime}
                onChange={(e) => handleEveningTimeChange(e.target.value)}
                className="w-28"
              />
            </div>
            
            {/* Next reminder status */}
            {nextReminderTime && (
              <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg">
                <CalendarClock className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground">
                  Next reminder: <span className="font-medium">{format(nextReminderTime, 'EEE, MMM d \'at\' h:mm a')}</span>
                </span>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Reminders appear when you open the app after the scheduled time. Works reliably on installed PWA.
            </p>
          </div>
        )}
      </div>

      {/* Cloud Sync Status */}
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

      {/* Privacy */}
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

      {/* Data Summary */}
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

      {/* Admin Access - Only shown to admins */}
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

      {/* App Updates */}
      <div className="glass-card p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <RefreshCw className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">App Updates</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Current version: <span className="font-mono">{currentVersion}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCheckForUpdates}
            disabled={isChecking}
            className="flex-1"
          >
            {isChecking ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Check for Updates
              </>
            )}
          </Button>
          {updateAvailable && (
            <Button size="sm" onClick={performUpdate} className="flex-1">
              Update Now
            </Button>
          )}
        </div>
      </div>

      {/* About */}
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

      {/* Contact Us */}
      <a 
        href="mailto:contact@tracktsw.app" 
        className="glass-card p-4 block hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Contact Us</h3>
            <p className="text-sm text-muted-foreground">Get in touch with our team (contact@tracktsw.app)</p>
          </div>
        </div>
      </a>

      {/* Sign Out */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-destructive/10">
            <LogOut className="w-5 h-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Sign Out</h3>
            <p className="text-sm text-muted-foreground">Sign out of your account</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
