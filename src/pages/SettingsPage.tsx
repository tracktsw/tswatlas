import { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Clock, Shield, Info, UserCog, LogOut, Cloud, Loader2 } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useUserData } from '@/contexts/UserDataContext';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import SubscriptionCard from '@/components/SubscriptionCard';
import { useSubscription } from '@/hooks/useSubscription';

const SettingsPage = () => {
  const { reminderSettings, updateReminderSettings, photos, checkIns, journalEntries, isLoading, isSyncing } = useUserData();
  const { isAdmin, refreshSubscription } = useSubscription();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
            <p className="text-xs text-muted-foreground">
              Note: Browser notifications need to be enabled for reminders to work.
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

      {/* About */}
      <div className="glass-card p-4">
        <h3 className="font-semibold text-foreground mb-2">About TSW Atlas</h3>
        <p className="text-sm text-muted-foreground">
          A privacy-focused app to help you track your Topical Steroid Withdrawal journey. 
          Remember: healing is not linear, and every day you're getting closer to healthy skin.
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          Version 1.0.0 • Made with care
        </p>
      </div>

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
