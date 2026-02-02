import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useNavigate } from 'react-router-dom';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { OnboardingProgress } from './OnboardingProgress';
import { FloatingLeaf } from './FloatingLeaf';
import { Capacitor } from '@capacitor/core';
import { cn } from '@/lib/utils';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';

// Import all feature images
import improvementImage from '@/assets/onboarding-improvement.png';
import triggersImage from '@/assets/onboarding-triggers.png';
import foodImage from '@/assets/onboarding-food.png';
import productImage from '@/assets/onboarding-product.png';
import symptomsImage from '@/assets/onboarding-symptoms.png';
import sleepImage from '@/assets/onboarding-sleep.png';

const featureSlides = [
  { image: improvementImage, headline: "Turn 'good days' into a repeatable strategy." },
  { image: triggersImage, headline: "The flares are loud. The data is louder." },
  { image: foodImage, headline: "Log what you eat and see how your skin responds." },
  { image: productImage, headline: "Identify products that appear before flares." },
  { image: symptomsImage, headline: "Your symptoms are real. Your data makes them undeniable." },
  { image: sleepImage, headline: "Your flares are stealing your sleep." },
];

export const OnboardingScreen2: React.FC = () => {
  const { nextScreen, prevScreen, skipOnboarding } = useOnboarding();
  const navigate = useNavigate();
  const { impact } = useHapticFeedback();
  const platform = Capacitor.getPlatform();

  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

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

  // Auto-advance carousel
  useEffect(() => {
    if (!api) return;

    const interval = setInterval(() => {
      api.scrollNext();
    }, 4000);

    return () => clearInterval(interval);
  }, [api]);

  // Track current slide
  useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      setCurrent(api.selectedScrollSnap());
    };

    api.on('select', onSelect);
    onSelect();

    return () => {
      api.off('select', onSelect);
    };
  }, [api]);

  const scrollTo = useCallback(
    (index: number) => {
      api?.scrollTo(index);
    },
    [api]
  );

  const isAndroid = platform === 'android';

  return (
    <div
      className={cn(
        'flex flex-col bg-background relative box-border',
        isAndroid ? 'android-onboarding-root' : 'overflow-hidden'
      )}
      style={!isAndroid ? { height: '100svh' } : undefined}
    >
      <FloatingLeaf />

      {/* Header */}
      <motion.div
        className={cn(
          'flex items-center justify-between px-4 shrink-0',
          isAndroid && 'android-onboarding-fixed'
        )}
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
          className="text-foreground text-sm font-semibold px-3 py-2 hover:text-foreground/80 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Skip onboarding"
        >
          Skip
        </button>
      </motion.div>

      {/* Main content */}
      <div
        className={cn(
          'flex-1 flex flex-col px-6 min-h-0',
          isAndroid && 'android-onboarding-content'
        )}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="py-4 space-y-4 flex-1 flex flex-col"
        >
          {/* Headline */}
          <div className="space-y-2">
            <motion.h1
              className="font-display text-2xl md:text-3xl font-bold text-foreground leading-tight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              Everything you need to understand your TSW
            </motion.h1>
          </div>

          {/* Feature Carousel */}
          <div className="flex-1 flex flex-col justify-center">
            <Carousel
              setApi={setApi}
              opts={{
                loop: true,
                align: 'center',
              }}
              className="w-full"
            >
              <CarouselContent>
                {featureSlides.map((slide, index) => (
                  <CarouselItem key={index}>
                    <motion.div
                      className="flex flex-col items-center space-y-4"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4 }}
                    >
                      <div className="relative w-full max-h-[40vh] overflow-hidden rounded-2xl shadow-lg">
                        <img
                          src={slide.image}
                          alt={slide.headline}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <p className="text-lg font-semibold text-foreground text-center px-2 leading-snug">
                        {slide.headline}
                      </p>
                    </motion.div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>

            {/* Dot indicators */}
            <div className="flex items-center justify-center gap-2 mt-6">
              {featureSlides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => scrollTo(index)}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all duration-300',
                    current === index
                      ? 'w-6 bg-primary'
                      : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  )}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <div
        className={cn('px-6 space-y-4 shrink-0', isAndroid && 'android-onboarding-fixed')}
        style={{ paddingBottom: 'calc(var(--safe-bottom, 0px) + 16px)' }}
      >
        <OnboardingProgress current={1} total={2} />
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
