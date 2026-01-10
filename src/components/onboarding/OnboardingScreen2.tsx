import React from 'react';
import { motion } from 'framer-motion';
import { Leaf, ArrowLeft, HelpCircle, Users, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useNavigate } from 'react-router-dom';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { OnboardingProgress } from './OnboardingProgress';

export const OnboardingScreen2: React.FC = () => {
  const { nextScreen, prevScreen, skipOnboarding, currentScreen, totalScreens } = useOnboarding();
  const navigate = useNavigate();
  const { impact } = useHapticFeedback();

  const handleSkip = async () => {
    await impact('light');
    skipOnboarding();
    navigate('/auth');
  };

  const handleBack = async () => {
    await impact('light');
    prevScreen();
  };

  const handleContinue = async () => {
    await impact('light');
    nextScreen();
  };

  const painPoints = [
    {
      icon: HelpCircle,
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      text: 'Conflicting advice everywhere',
    },
    {
      icon: Users,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      text: "What works for others fails you",
    },
    {
      icon: Shuffle,
      iconBg: 'bg-rose-100 dark:bg-rose-900/30',
      iconColor: 'text-rose-600 dark:text-rose-400',
      text: 'Flares appear randomly',
    },
  ];

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
      <div className="flex-1 flex flex-col justify-center px-6 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="space-y-8"
        >
          {/* Headlines */}
          <div className="space-y-3">
            <motion.h1 
              className="font-display text-2xl md:text-3xl font-bold text-foreground leading-tight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              TSW is unpredictable.{' '}
              <span className="text-anchor">But patterns exist.</span>
            </motion.h1>
          </div>

          {/* Pain points */}
          <div className="space-y-4">
            {painPoints.map((point, i) => (
              <motion.div
                key={i}
                className="glass-card p-4 flex items-center gap-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
              >
                <div className={`w-12 h-12 rounded-xl ${point.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <point.icon className={`w-6 h-6 ${point.iconColor}`} />
                </div>
                <p className="text-foreground font-medium">{point.text}</p>
              </motion.div>
            ))}
          </div>

          {/* Insight teaser */}
          <motion.div
            className="bg-primary/10 border border-primary/20 rounded-2xl p-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Leaf className="w-5 h-5 text-primary" />
              </div>
              <p className="text-foreground text-sm leading-relaxed">
                <span className="font-semibold">In 30 days of tracking,</span> most users discover 2-3 triggers they never suspected.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Footer with progress and CTA */}
      <div className="px-6 pb-6 space-y-4" style={{ paddingBottom: 'calc(var(--safe-bottom) + 1.5rem)' }}>
        <OnboardingProgress current={1} total={5} />
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
            Show Me My Insights
          </Button>
        </motion.div>
      </div>
    </div>
  );
};
