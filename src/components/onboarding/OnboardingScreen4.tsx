import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useNavigate } from 'react-router-dom';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { OnboardingProgress } from './OnboardingProgress';
import symptomsImage from '@/assets/onboarding-symptoms.png';
import sleepImage from '@/assets/onboarding-sleep.png';

export const OnboardingScreen4: React.FC = () => {
  const { nextScreen, prevScreen, skipOnboarding } = useOnboarding();
  const navigate = useNavigate();
  const { impact } = useHapticFeedback();

  const screenshots = [
    {
      image: symptomsImage,
      headline: "Your symptoms are real. Your data makes them undeniable.",
    },
    {
      image: sleepImage,
      headline: "Your Flares Are Stealing Your Sleep.",
    },
  ];

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

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background relative overflow-hidden">
      {/* Header with back and skip */}
      <div 
        className="flex items-center justify-between px-4 pt-4 shrink-0"
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

      {/* Main content - scrollable */}
      <div className="flex-1 flex flex-col px-6 overflow-y-auto min-h-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="space-y-4 py-4"
        >
          {/* Headlines */}
          <div className="space-y-2">
            <motion.h1 
              className="font-display text-2xl md:text-3xl font-bold leading-tight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              <span className="text-foreground">TSW affects </span>
              <span className="text-primary">everything.</span>
            </motion.h1>
          </div>

          {/* Screenshots stacked */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="space-y-4"
          >
            {screenshots.map((screenshot, index) => (
              <div key={index} className="space-y-1.5">
                {/* Headline */}
                <h3 className="text-sm font-bold text-foreground text-center leading-snug">
                  {screenshot.headline}
                </h3>
                
                {/* Screenshot - reduced size */}
                <img
                  src={screenshot.image}
                  alt={screenshot.headline}
                  className="w-[90%] mx-auto h-auto rounded-xl shadow-lg border border-border"
                />
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Footer with progress and CTA - fixed at bottom */}
      <div className="px-6 pb-6 space-y-4 shrink-0" style={{ paddingBottom: 'calc(var(--safe-bottom) + 1.5rem)' }}>
        <OnboardingProgress current={3} total={4} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <Button 
            onClick={handleContinue}
            className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90"
          >
            Continue
          </Button>
        </motion.div>
      </div>
    </div>
  );
};