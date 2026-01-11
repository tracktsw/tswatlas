import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useNavigate } from 'react-router-dom';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import trackTswLogo from '@/assets/tracktsw-logo-transparent.png';

export const OnboardingScreen1: React.FC = () => {
  const { nextScreen, skipOnboarding } = useOnboarding();
  const navigate = useNavigate();
  const { impact } = useHapticFeedback();

  const handleSkip = async () => {
    await impact('light');
    skipOnboarding();
    navigate('/auth');
  };

  const handleContinue = async () => {
    await impact('light');
    nextScreen();
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background relative overflow-hidden">
      {/* Skip button */}
      <div className="absolute top-4 right-4 z-10" style={{ paddingTop: 'var(--safe-top)' }}>
        <button
          onClick={handleSkip}
          className="text-muted-foreground text-sm font-medium px-3 py-2 hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Skip onboarding"
        >
          Skip
        </button>
      </div>

      {/* Logo */}
      <div className="pt-6 px-6" style={{ paddingTop: 'calc(var(--safe-top) + 1.5rem)' }}>
        <div className="flex items-center gap-2">
          <img src={trackTswLogo} alt="TrackTSW" className="w-10 h-10 object-contain" />
          <span className="font-display font-semibold text-anchor">TrackTSW</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col justify-center px-6 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="space-y-6"
        >
          {/* Headlines */}
          <div className="space-y-3">
            <motion.h1 
              className="font-display text-3xl md:text-4xl font-bold text-foreground leading-tight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              Stop Guessing.{' '}
              <span className="text-anchor">Start Healing.</span>
            </motion.h1>
            
            <motion.p 
              className="text-muted-foreground text-lg leading-relaxed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              Discover what actually helps YOUR TSW skin through personalized data insights
            </motion.p>
          </div>

          {/* Visual illustration - minimalist upward trend */}
          <motion.div 
            className="py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <div className="glass-card p-6 rounded-2xl">
              <div className="flex items-end justify-center gap-1.5 h-24">
                {[30, 45, 35, 55, 50, 70, 85].map((height, i) => (
                  <motion.div
                    key={i}
                    className="w-6 rounded-t-lg bg-gradient-to-t from-[#F4C753]/40 to-[#F4C753]"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: `${height}%`, opacity: 1 }}
                    transition={{ 
                      delay: 0.6 + i * 0.15, 
                      duration: 0.5, 
                      ease: 'easeOut' 
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-center gap-2 mt-4 text-muted-foreground text-sm">
                <TrendingUp className="w-4 h-4 text-[#F4C753]" />
                <span>Your healing journey, visualized</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* CTA Button */}
      <div className="px-6 pb-6" style={{ paddingBottom: 'calc(var(--safe-bottom) + 1.5rem)' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.4 }}
        >
          <Button 
            onClick={handleContinue}
            className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90"
          >
            See How It Works
          </Button>
        </motion.div>
      </div>
    </div>
  );
};