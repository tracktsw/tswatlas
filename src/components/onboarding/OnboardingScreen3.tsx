import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useNavigate } from 'react-router-dom';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { OnboardingProgress } from './OnboardingProgress';
import { OnboardingImprovementCard } from './OnboardingImprovementCard';
import { OnboardingTriggersCard } from './OnboardingTriggersCard';

export const OnboardingScreen3: React.FC = () => {
  const { nextScreen, prevScreen, skipOnboarding } = useOnboarding();
  const navigate = useNavigate();
  const { impact } = useHapticFeedback();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      component: <OnboardingImprovementCard />,
      headline: "Turn 'good days' into a repeatable strategy.",
    },
    {
      component: <OnboardingTriggersCard />,
      headline: "The flares are loud. The data is louder.",
    },
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

          {/* Carousel */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="relative"
          >
            <Card className="p-4 overflow-hidden">
              {/* Carousel navigation arrows */}
              <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
                <button
                  onClick={prevSlide}
                  className="p-2 rounded-full bg-background/80 hover:bg-background shadow-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="w-5 h-5 text-foreground" />
                </button>
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                <button
                  onClick={nextSlide}
                  className="p-2 rounded-full bg-background/80 hover:bg-background shadow-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Next slide"
                >
                  <ChevronRight className="w-5 h-5 text-foreground" />
                </button>
              </div>

              {/* Slides */}
              <div className="relative overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSlide}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="space-y-3"
                  >
                    {/* Slide headline */}
                    <h3 className="text-sm font-semibold text-foreground text-center px-8">
                      {slides[currentSlide].headline}
                    </h3>
                    
                    {/* Slide component */}
                    <div className="rounded-lg overflow-hidden">
                      {slides[currentSlide].component}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Dots indicator */}
              <div className="flex items-center justify-center gap-2 mt-4">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 min-h-[44px] min-w-[44px] flex items-center justify-center`}
                    aria-label={`Go to slide ${index + 1}`}
                  >
                    <span 
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        index === currentSlide 
                          ? 'bg-primary w-4' 
                          : 'bg-muted-foreground/30'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </Card>
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
