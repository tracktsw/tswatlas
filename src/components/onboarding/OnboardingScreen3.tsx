import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, Moon, Droplets, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useNavigate } from 'react-router-dom';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { OnboardingProgress } from './OnboardingProgress';

export const OnboardingScreen3: React.FC = () => {
  const { nextScreen, prevScreen, skipOnboarding } = useOnboarding();
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

  const handleCardTap = async () => {
    await impact('light');
  };

  // Sample demo insights
  const sampleInsights = [
    {
      icon: Droplets,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      text: 'Your worst flares happen 2 days after dairy consumption',
    },
    {
      icon: Moon,
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      text: 'Symptoms improve 40% on days you sleep 7+ hours',
    },
  ];

  // Demo chart data
  const chartData = [
    { day: 'Mon', skin: 3, sleep: 4 },
    { day: 'Tue', skin: 2, sleep: 2 },
    { day: 'Wed', skin: 4, sleep: 5 },
    { day: 'Thu', skin: 3, sleep: 3 },
    { day: 'Fri', skin: 5, sleep: 5 },
    { day: 'Sat', skin: 4, sleep: 4 },
    { day: 'Sun', skin: 5, sleep: 5 },
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
              Here's what you'll discover
            </motion.h1>
          </div>

          {/* Demo chart */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Skin vs Sleep Quality</span>
              </div>
              
              {/* Simple bar chart */}
              <div className="flex items-end justify-between gap-2 h-32 px-2">
                {chartData.map((data, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="flex items-end gap-0.5 h-24 w-full">
                      <motion.div
                        className="flex-1 bg-primary rounded-t"
                        initial={{ height: 0 }}
                        animate={{ height: `${(data.skin / 5) * 100}%` }}
                        transition={{ delay: 0.3 + i * 0.05, duration: 0.4 }}
                      />
                      <motion.div
                        className="flex-1 bg-indigo-400/60 rounded-t"
                        initial={{ height: 0 }}
                        animate={{ height: `${(data.sleep / 5) * 100}%` }}
                        transition={{ delay: 0.35 + i * 0.05, duration: 0.4 }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{data.day}</span>
                  </div>
                ))}
              </div>
              
              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-primary" />
                  <span>Skin</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-indigo-400/60" />
                  <span>Sleep</span>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Sample insight cards */}
          <div className="space-y-3">
            {sampleInsights.map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCardTap}
              >
                <Card className="p-4 flex items-start gap-3 cursor-pointer active:bg-muted/50 transition-colors">
                  <div className={`w-10 h-10 rounded-xl ${insight.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <insight.icon className={`w-5 h-5 ${insight.iconColor}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">AI Insight</span>
                    </div>
                    <p className="text-foreground text-sm leading-relaxed">{insight.text}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
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
            className="w-full h-14 text-base font-semibold"
            variant="action"
          >
            I Want This For My Journey
          </Button>
        </motion.div>
      </div>
    </div>
  );
};
