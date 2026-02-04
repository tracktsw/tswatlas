import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { scheduleCheckInReminders } from '@/utils/notificationScheduler';
import { useUserData } from '@/contexts/UserDataContext';

const STORAGE_KEY = 'hasSeenNotificationPrompt';

interface NotificationOptInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NotificationOptInModal = ({ open, onOpenChange }: NotificationOptInModalProps) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const { reminderSettings, updateReminderSettings } = useUserData();

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      const result = await LocalNotifications.requestPermissions();
      
      if (result.display === 'granted') {
        // Enable reminders in settings
        await updateReminderSettings({ ...reminderSettings, enabled: true });
        
        // Schedule notifications
        await scheduleCheckInReminders(reminderSettings.reminderTime, true);
        
        toast.success('Notifications enabled! You\'ll get daily reminders.');
      } else {
        toast.info('You can enable notifications later in Settings.');
      }
      
      localStorage.setItem(STORAGE_KEY, 'true');
      onOpenChange(false);
    } catch (error) {
      console.error('[NotificationOptIn] Error requesting permission:', error);
      toast.error('Something went wrong. Try again in Settings.');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Bell className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">Stay on track</DialogTitle>
          <DialogDescription className="text-base pt-2">
            Get a gentle daily reminder to log your symptoms. Consistent tracking reveals patterns that help you heal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-4">
          <Button 
            onClick={handleEnable} 
            className="w-full"
            disabled={isRequesting}
          >
            {isRequesting ? 'Enabling...' : 'Enable Notifications'}
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={handleSkip}
            className="w-full text-muted-foreground"
          >
            Not now
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            You can change this anytime in Settings.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const shouldShowNotificationPrompt = (): boolean => {
  // Only on native platforms
  if (!Capacitor.isNativePlatform()) return false;
  
  // Check if user has already seen the prompt
  if (localStorage.getItem(STORAGE_KEY) === 'true') return false;
  
  // Check if user has completed onboarding
  if (localStorage.getItem('hasSeenOnboarding') !== 'true') return false;
  
  return true;
};

export default NotificationOptInModal;
