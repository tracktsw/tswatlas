import { useState } from 'react';
import { Bell, X, Clock, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlatform } from '@/hooks/usePlatform';

interface ReminderBannerProps {
  reminderType: 'morning' | 'evening';
  onDismiss: () => void;
  onSnooze: (hours?: number) => void;
}

export function ReminderBanner({ reminderType, onDismiss, onSnooze }: ReminderBannerProps) {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);
  const { isAndroid } = usePlatform();

  const handleCheckIn = () => {
    setIsVisible(false);
    navigate('/check-in');
    onDismiss();
  };

  const handleSnooze = () => {
    setIsVisible(false);
    onSnooze(1); // Snooze for 1 hour
  };

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss();
  };

  const timeLabel = reminderType === 'morning' ? 'morning' : 'evening';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="fixed left-0 right-0 z-50 p-3"
          style={isAndroid ? { top: 0 } : { top: 'var(--safe-top)' }}
        >
          <div className="max-w-lg mx-auto">
            <div className="bg-primary text-primary-foreground rounded-2xl shadow-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary-foreground/20 rounded-full shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base">
                    Time for your {timeLabel} check-in!
                  </h3>
                  <p className="text-sm opacity-90 mt-0.5">
                    Track your progress and treatments
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleCheckIn}
                      className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      Check in now
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSnooze}
                      className="text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary-foreground/10"
                    >
                      <Clock className="w-4 h-4 mr-1.5" />
                      In 1 hour
                    </Button>
                  </div>
                </div>
                
                <button
                  onClick={handleDismiss}
                  className="p-1.5 rounded-full hover:bg-primary-foreground/10 transition-colors shrink-0"
                  aria-label="Dismiss reminder"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
