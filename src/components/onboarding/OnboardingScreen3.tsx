import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useNavigate } from 'react-router-dom';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { OnboardingProgress } from './OnboardingProgress';
import improvementImage from '@/assets/onboarding-improvement.png';
import triggersImage from '@/assets/onboarding-triggers.png';

export const OnboardingScreen3: React.FC = () => {
  const { nextScreen, prevScreen, skipOnboarding } = useOnboarding();
  const navigate = useNavigate();
  const { impact } = useHapticFeedback();
  const [currentSlide, setCurrentSlide] = useState(0);

  const screenshots = [
    {
      image: improvementImage,
      headline: "Turn 'good days' into a repeatable strategy.",
    },
    {
      image: triggersImage,
      headline: "The flares are loud. The data is louder.",
    },
  ];

  // Slides for carousel - first slide contains both screenshots, more can be added later
  const slides = [
    { type: 'screenshots' as const },
    // Add more slides here later
  ];

  const goToSlide = useCallback(async (index: number) => {
    await impact('light');
    setCurrentSlide(index);
  }, [impact]);

  const nextSlide = useCallback(async () => {
    await impact('light');
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, [impact, slides.length]);

  const prevSlide = useCallback(async () => {
    await impact('light');
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  }, [impact, slides.length]);

  // Auto-advance carousel every 8 seconds
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
              You have a life to get back.{' '}
              <span className="text-primary">Time to get out of TSW.</span>
            </motion.h1>
          </div>

          {/* Screenshots stacked */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="space-y-6"
          >
            {screenshots.map((screenshot, index) => (
              <div key={index} className="space-y-2">
                {/* Headline */}
                <h3 className="text-base font-bold text-foreground text-center leading-snug">
                  {screenshot.headline}
                </h3>
                
                {/* Screenshot - natural size */}
                <img
                  src={screenshot.image}
                  alt={screenshot.headline}
                  className="w-full h-auto rounded-2xl shadow-xl border border-border"
                />
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Footer with progress and CTA */}
      <div className="px-6 pb-6 space-y-4" style={{ paddingBottom: 'calc(var(--safe-bottom) + 1.5rem)' }}>
        <OnboardingProgress current={2} total={5} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <Button 
            onClick={handleContinue}
            className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90"
          >
            I Want This For My Journey
          </Button>
        </motion.div>
      </div>
    </div>
  );
};
