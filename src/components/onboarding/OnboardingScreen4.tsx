import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useNavigate } from 'react-router-dom';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Capacitor } from '@capacitor/core';
import { OnboardingProgress } from './OnboardingProgress';
import { FloatingLeaf } from './FloatingLeaf';
import symptomsImage from '@/assets/onboarding-symptoms.png';
import sleepImage from '@/assets/onboarding-sleep.png';
import { cn } from '@/lib/utils';

export const OnboardingScreen4: React.FC = () => {
  const { nextScreen, prevScreen, skipOnboarding } = useOnboarding();
  const navigate = useNavigate();
  const { impact } = useHapticFeedback();
  const platform = Capacitor.getPlatform();

  const screenshots = [
    {
      image: symptomsImage,
      headline: "Your symptoms are real. Your data makes them undeniable.",
    },
    {
      image: sleepImage,
      headline: "Your flares are stealing your sleep.",
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

  // E) Fix onboarding squish: Use measured viewport height on Android, 100svh on iOS
  const isAndroid = platform === 'android';

  return (
    <div 
      className={cn(
        "flex flex-col bg-background relative box-border overflow-hidden",
        isAndroid && "android-full-height"
      )}
      style={!isAndroid ? { height: '100svh' } : undefined}
    >
      {/* Floating leaf animation */}
      <FloatingLeaf />
      
      {/* Header with back and skip - with safe area padding */}
      <motion.div 
        className="flex items-center justify-between px-4 shrink-0"
        style={{
          paddingTop:
            platform === 'ios'
              ? 'calc(var(--safe-area-inset-top, 0px) + 6px)'
              : 'calc(var(--safe-area-inset-top, 0px) + 12px)',
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

      {/* Main content - centered like other screens */}
      <div className="flex-1 flex flex-col justify-center px-6 min-h-0 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="space-y-4 py-2"
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

          {/* Screenshots stacked - height responsive */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="space-y-4"
          >
            {screenshots.map((screenshot, index) => (
              <div key={index} className="space-y-1.5">
                <h3 className="text-sm font-bold text-foreground text-center leading-snug">
                  {screenshot.headline}
                </h3>
                
                <img
                  src={screenshot.image}
                  alt={screenshot.headline}
                  className="w-[90%] mx-auto h-auto rounded-xl shadow-lg border border-border"
                  style={{ maxHeight: '25vh', objectFit: 'contain' }}
                />
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Footer with progress and CTA - with safe area padding */}
      <div
        className="px-6 shrink-0 space-y-4"
        style={{
          paddingBottom: 'calc(var(--safe-area-inset-bottom, 0px) + 24px)',
        }}
      >
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
            Let's Get Started
          </Button>
        </motion.div>
      </div>
    </div>
  );
};