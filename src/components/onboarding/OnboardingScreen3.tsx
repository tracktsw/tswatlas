import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useNavigate } from 'react-router-dom';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { OnboardingProgress } from './OnboardingProgress';
import { FloatingLeaf } from './FloatingLeaf';
import improvementImage from '@/assets/onboarding-improvement.png';
import triggersImage from '@/assets/onboarding-triggers.png';
import { Capacitor } from '@capacitor/core';
import { cn } from '@/lib/utils';

export const OnboardingScreen3: React.FC = () => {
  const { nextScreen, prevScreen, skipOnboarding } = useOnboarding();
  const navigate = useNavigate();
  const { impact } = useHapticFeedback();
  const platform = Capacitor.getPlatform();

  // Kept for parity with your existing code (even though you render both screenshots)
  const [currentSlide, setCurrentSlide] = useState(0);

  const screenshots = [
    {
      image: improvementImage,
      headline: "Turn 'good days' into a repeatable strategy.",
    },
    {
      image: triggersImage,
      headline: 'The flares are loud. The data is louder.',
    },
  ];

  const slides = [{ type: 'screenshots' as const }];

  const goToSlide = useCallback(
    async (index: number) => {
      await impact('light');
      setCurrentSlide(index);
    },
    [impact]
  );

  const nextSlide = useCallback(async () => {
    await impact('light');
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, [impact, slides.length]);

  const prevSlide = useCallback(async () => {
    await impact('light');
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  }, [impact, slides.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 8000);

    return () => clearInterval(timer);
  }, [slides.length]);

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

      {/* Main content (standardized wrapper) */}
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
              You have a life to get back. <span className="text-primary">Time to get out of TSW.</span>
            </motion.h1>
          </div>

          {/* Screenshots stacked (keep image headlines centered if you like; top headline now aligns with Screen 2) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="space-y-6"
          >
            {screenshots.map((screenshot, index) => (
              <div key={index} className="space-y-2">
                <h3 className="text-base font-bold text-foreground text-center leading-snug">
                  {screenshot.headline}
                </h3>

                <img
                  src={screenshot.image}
                  alt={screenshot.headline}
                  className="w-full h-auto rounded-2xl shadow-xl border border-border"
                  style={{ maxHeight: '28vh', objectFit: 'contain' }}
                />
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="px-6 space-y-4 shrink-0" style={{ paddingBottom: 'calc(var(--safe-bottom, 0px) + 16px)' }}>
        <OnboardingProgress current={2} total={4} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <Button onClick={handleContinue} className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90">
            I Want This For My Journey
          </Button>
        </motion.div>
      </div>
    </div>
  );
};