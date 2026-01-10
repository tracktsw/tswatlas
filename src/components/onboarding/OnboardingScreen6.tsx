import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, Moon, Frown, Smile, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useNavigate } from 'react-router-dom';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { OnboardingProgress } from './OnboardingProgress';
import { format } from 'date-fns';

const moodEmojis = ['😢', '😟', '😐', '🙂', '😊'];

export const OnboardingScreen6: React.FC = () => {
  const { prevScreen, completeOnboarding, data } = useOnboarding();
  const navigate = useNavigate();
  const { impact, notification } = useHapticFeedback();

  const handleBack = async () => {
    await impact('light');
    prevScreen();
  };

  const handleContinue = async () => {
    await notification('success');
    completeOnboarding();
    navigate('/auth');
  };

  const firstLog = data.firstLog;
  const today = format(new Date(), 'MMMM d, yyyy');

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background relative overflow-hidden">
      {/* Header with back only (no skip on final screen) */}
      <div 
        className="flex items-center justify-between px-4 pt-4"
        style={{ paddingTop: 'calc(var(--safe-top) + 1rem)' }}
      >
        <button
          onClick={handleBack}
          className="p-2 rounded-xl hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Go back to edit"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="w-11" /> {/* Spacer for alignment */}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col justify-center px-6 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="space-y-6"
        >
          {/* Success animation */}
          <motion.div 
            className="flex justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          >
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
              >
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </motion.div>
            </div>
          </motion.div>

          {/* Headlines */}
          <div className="text-center space-y-2">
            <motion.h1 
              className="font-display text-2xl md:text-3xl font-bold text-foreground leading-tight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              Here's your first entry! 🌱
            </motion.h1>
          </div>

          {/* Entry summary card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Day 1</span>
                <span className="text-sm text-muted-foreground">{today}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Skin</div>
                  <div className="text-lg font-bold text-foreground">{firstLog?.skin ?? '-'}/10</div>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Pain</div>
                  <div className="text-lg font-bold text-foreground">{firstLog?.pain ?? '-'}/10</div>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                    <Moon className="w-3 h-3" /> Sleep
                  </div>
                  <div className="text-lg font-bold text-foreground">{'⭐'.repeat(firstLog?.sleep ?? 0)}</div>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Mood</div>
                  <div className="text-2xl">{firstLog?.mood ? moodEmojis[firstLog.mood - 1] : '-'}</div>
                </div>
              </div>

              {firstLog?.triggers && (
                <div className="bg-muted/50 rounded-xl p-3">
                  <div className="text-xs text-muted-foreground mb-1">Triggers</div>
                  <div className="text-sm text-foreground">{firstLog.triggers}</div>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>29 more days to unlock full pattern insights</span>
              </div>
            </Card>
          </motion.div>

          {/* Encouraging message */}
          <motion.p
            className="text-center text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            You're on your way to understanding your TSW journey!
          </motion.p>
        </motion.div>
      </div>

      {/* Footer with progress and CTA */}
      <div className="px-6 pb-6 space-y-4" style={{ paddingBottom: 'calc(var(--safe-bottom) + 1.5rem)' }}>
        <OnboardingProgress current={5} total={5} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <Button 
            onClick={handleContinue}
            className="w-full h-14 text-base font-semibold"
            variant="action"
          >
            Create Account to Continue
          </Button>
        </motion.div>
      </div>
    </div>
  );
};
