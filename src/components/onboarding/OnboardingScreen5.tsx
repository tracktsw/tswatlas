import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Target, TrendingUp, Zap, Search, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useNavigate } from 'react-router-dom';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { OnboardingProgress } from './OnboardingProgress';
import { cn } from '@/lib/utils';

const durationOptions = [
  { value: '<3 months', label: 'Less than 3 months' },
  { value: '3-6 months', label: '3-6 months' },
  { value: '6-12 months', label: '6-12 months' },
  { value: '1+ year', label: '1+ year' },
];

const goalOptions = [
  { value: 'triggers', label: 'Identify triggers', icon: Search },
  { value: 'progress', label: 'Track progress', icon: TrendingUp },
  { value: 'relief', label: 'Find relief', icon: Zap },
  { value: 'patterns', label: 'Understand patterns', icon: Target },
];

export const OnboardingScreen5: React.FC = () => {
  const { prevScreen, skipOnboarding, completeOnboarding, data, setTswDuration, setGoal } = useOnboarding();
  const navigate = useNavigate();
  const { impact, selectionChanged, notification } = useHapticFeedback();

  const [duration, setDuration] = useState<string | null>(data.tswDuration);
  const [goal, setGoalLocal] = useState<string | null>(data.goal);

  const isComplete = duration !== null && goal !== null;

  const handleSkip = async () => {
    await impact('light');
    skipOnboarding();
    navigate('/auth');
  };

  const handleBack = async () => {
    await impact('light');
    prevScreen();
  };

  const handleDurationSelect = async (value: string) => {
    await selectionChanged();
    setDuration(value);
    setTswDuration(value);
  };

  const handleGoalSelect = async (value: string) => {
    await selectionChanged();
    setGoalLocal(value);
    setGoal(value);
  };

  const handleContinue = async () => {
    if (!isComplete) return;
    await notification('success');
    completeOnboarding();
    navigate('/auth');
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background relative overflow-hidden">
      {/* Header with back and skip */}
      <div 
        className="flex items-center justify-between px-4 pt-4"
        style={{ paddingTop: 'calc(var(--safe-top) + 1rem)' }}
      >
        <button
          onClick={handleBack}
          className="p-2 rounded-xl hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <button
          onClick={handleSkip}
          className="text-muted-foreground text-sm font-medium px-3 py-2 hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Skip onboarding"
        >
          Skip
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col px-6 pb-8 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="space-y-6 py-4"
        >
          {/* Headlines */}
          <div className="space-y-2">
            <motion.h1 
              className="font-display text-2xl md:text-3xl font-bold text-foreground leading-tight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              Let's personalize your experience
            </motion.h1>
          </div>

          {/* Question 1: Duration */}
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">How long have you been experiencing TSW?</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {durationOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleDurationSelect(option.value)}
                  className={cn(
                    'p-3 rounded-xl border-2 text-sm font-medium transition-all min-h-[44px]',
                    duration === option.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-foreground hover:border-primary/50'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Question 2: Goal */}
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">What's your main goal?</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {goalOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleGoalSelect(option.value)}
                  className={cn(
                    'p-3 rounded-xl border-2 text-sm font-medium transition-all flex flex-col items-center gap-2 min-h-[72px]',
                    goal === option.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-foreground hover:border-primary/50'
                  )}
                >
                  <option.icon className="w-5 h-5" />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Footer with progress and CTA */}
      <div className="px-6 pb-6 space-y-4" style={{ paddingBottom: 'calc(var(--safe-bottom) + 1.5rem)' }}>
        <OnboardingProgress current={4} total={4} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <Button 
            onClick={handleContinue}
            className="w-full h-14 text-base font-semibold"
            variant="action"
            disabled={!isComplete}
          >
            Create Account to Continue
          </Button>
        </motion.div>
      </div>
    </div>
  );
};
