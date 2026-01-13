import React from 'react';
import { motion } from 'framer-motion';
import { Leaf, ArrowLeft, HelpCircle, Users, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useNavigate } from 'react-router-dom';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { OnboardingProgress } from './OnboardingProgress';
import { FloatingLeaf } from './FloatingLeaf';
import { Capacitor } from '@capacitor/core';

export const OnboardingScreen2: React.FC = () => {
  const { nextScreen, prevScreen, skipOnboarding } = useOnboarding();
  const navigate = useNavigate();
  const { impact } = useHapticFeedback();
  const platform = Capacitor.getPlatform();

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
      text: 'No one has clear answers',
    },
    {
      icon: Leaf,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      text: 'You try everything, nothing sticks',
    },
    {
      icon: Users,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      text: 'What works for others fails you',
    },
    {
      icon: Shuffle,
      iconBg: 'bg-rose-100 dark:bg-rose-900/30',
      iconColor: 'text-rose-600 dark:text-rose-400',
      text: 'Flares appear randomly',
    },
  ];

  return (
    <div className="flex flex-col bg-background relative box-border overflow-hidden" style={{ height: '100svh' }}>
      <FloatingLeaf />

      {/* Header */}
      <motion.div
        className="flex items-center justify-between px-4 shrink-0"
        style={{
          paddingTop:
            platform === 'ios'
              ? 'calc(var(--safe-top, 0px) + 4px)'
              : 'calc(var(--safe-top, 0px) + 12px)',
        }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
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
      </motion.div>

      {/* Main content (standardized: left-aligned, consistent start) */}
      <div className="flex-1 flex flex-col px-6 min-h-0 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="py-4 space-y-6"
        >
          {/* Headlines (standardized) */}
          <div className="space-y-2">
            <motion.h1
              className="font-display text-2xl md:text-3xl font-bold text-foreground leading-tight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              You’re not failing. <span className="text-anchor">The system is.</span>
            </motion.h1>

            <motion.p
              className="text-muted-foreground text-base leading-relaxed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              TSW is unpredictable. <span className="text-anchor">But patterns exist.</span>
            </motion.p>
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
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${point.iconBg}`}>
                  <point.icon className={`w-6 h-6 ${point.iconColor}`} />
                </div>
                <p className="text-foreground font-medium">{point.text}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="px-6 space-y-4 shrink-0" style={{ paddingBottom: 'calc(var(--safe-bottom, 0px) + 16px)' }}>
        <OnboardingProgress current={1} total={4} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <Button onClick={handleContinue} className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90">
            Show Me My Insights
          </Button>
        </motion.div>
      </div>
    </div>
  );
};