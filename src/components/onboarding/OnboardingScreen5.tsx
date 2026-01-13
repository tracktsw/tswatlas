import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Activity, Heart, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useNavigate } from 'react-router-dom';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Capacitor } from '@capacitor/core';
import { OnboardingProgress } from './OnboardingProgress';
import { FloatingLeaf } from './FloatingLeaf';
import { cn } from '@/lib/utils';
import { storePendingOnboardingSurvey } from '@/utils/analytics';

const impactOptions = [
  { value: 'mild', label: 'Mild inconvenience' },
  { value: 'frustrating', label: 'Frustrating but manageable' },
  { value: 'disrupting', label: 'Disrupting my sleep/work' },
  { value: 'takeover', label: 'Taking over my life' },
];

const hardestOptions = [
  { value: 'sleep', label: 'Sleep disruption' },
  { value: 'pain', label: 'Pain / burning' },
  { value: 'itch', label: 'Itch' },
  { value: 'appearance', label: 'Appearance' },
  { value: 'mental', label: 'Mental health impact' },
  { value: 'flares', label: 'Unpredictable flares' },
  { value: 'triggers', label: 'Not knowing my triggers' },
];

const hopingOptions = [
  { value: 'triggers', label: 'Understand my triggers' },
  { value: 'track', label: 'Track symptoms properly' },
  { value: 'improving', label: "See if I'm improving" },
  { value: 'control', label: 'Feel more in control' },
  { value: 'reduce', label: 'Reduce flare frequency' },
  { value: 'exploring', label: 'Just exploring for now' },
];

export const OnboardingScreen5: React.FC = () => {
  const { prevScreen, skipOnboarding, completeOnboarding } = useOnboarding();
  const navigate = useNavigate();
  const { impact, selectionChanged, notification } = useHapticFeedback();
  const platform = Capacitor.getPlatform();

  const [impactLevel, setImpactLevel] = useState<string | null>(null);
  const [hardest, setHardest] = useState<string | null>(null);
  const [hoping, setHoping] = useState<string | null>(null);

  const isComplete = impactLevel !== null && hardest !== null && hoping !== null;

  const handleSkip = async () => {
    await impact('light');
    skipOnboarding();
    navigate('/auth?mode=signup');
  };

  const handleBack = async () => {
    await impact('light');
    prevScreen();
  };

  const handleImpactSelect = async (value: string) => {
    await selectionChanged();
    setImpactLevel(value);
  };

  const handleHardestChange = async (value: string) => {
    await selectionChanged();
    setHardest(value);
  };

  const handleHopingChange = async (value: string) => {
    await selectionChanged();
    setHoping(value);
  };

  const handleContinue = async () => {
    if (!isComplete || !impactLevel || !hardest || !hoping) return;

    storePendingOnboardingSurvey(impactLevel, hardest, hoping);

    await notification('success');
    completeOnboarding();
    navigate('/auth?mode=signup');
  };

  return (
    <div className="flex flex-col bg-background relative box-border overflow-hidden" style={{ height: '100svh' }}>
      <FloatingLeaf />

      {/* Header (standardized) */}
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
          {/* Headline (standardized) */}
          <div className="space-y-2">
            <motion.h1
              className="font-display text-2xl md:text-3xl font-bold text-foreground leading-tight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              Help us understand how TSW affects you
            </motion.h1>
          </div>

          {/* Q1 */}
          <motion.div
            className="space-y-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                How much is TSW affecting your life right now?
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {impactOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleImpactSelect(option.value)}
                  className={cn(
                    'p-3 rounded-xl border-2 text-sm font-medium transition-all min-h-[44px]',
                    impactLevel === option.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-foreground hover:border-primary/50'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Q2 */}
          <motion.div
            className="space-y-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                What feels hardest to deal with right now?
              </span>
            </div>

            <Select value={hardest || undefined} onValueChange={handleHardestChange}>
              <SelectTrigger className="w-full h-12 bg-card border-2 border-border rounded-xl">
                <SelectValue placeholder="Select what's hardest..." />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-[100]">
                {hardestOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>

          {/* Q3 */}
          <motion.div
            className="space-y-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                What are you hoping this app will help you with most?
              </span>
            </div>

            <Select value={hoping || undefined} onValueChange={handleHopingChange}>
              <SelectTrigger className="w-full h-12 bg-card border-2 border-border rounded-xl">
                <SelectValue placeholder="Select your main goal..." />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-[100]">
                {hopingOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>

          <motion.p
            className="text-xs text-muted-foreground text-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            Your answers help us understand what you need so we can build features that are actually useful for you.
          </motion.p>
        </motion.div>
      </div>

      {/* Footer (standardized) */}
      <div className="px-6 space-y-3 shrink-0" style={{ paddingBottom: 'calc(var(--safe-bottom, 0px) + 16px)' }}>
        <OnboardingProgress current={4} total={4} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <Button
            onClick={handleContinue}
            className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
            disabled={!isComplete}
          >
            {isComplete ? 'Create Account To Begin Tracking' : 'Answer all questions to continue'}
          </Button>
        </motion.div>
      </div>
    </div>
  );
};