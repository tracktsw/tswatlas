import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useNavigate } from 'react-router-dom';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { OnboardingProgress } from './OnboardingProgress';
import { cn } from '@/lib/utils';

const moodEmojis = ['😢', '😟', '😐', '🙂', '😊'];
const moodLabels = ['Very bad', 'Bad', 'Okay', 'Good', 'Great'];

export const OnboardingScreen5: React.FC = () => {
  const { nextScreen, prevScreen, skipOnboarding, setFirstLog } = useOnboarding();
  const navigate = useNavigate();
  const { impact, selectionChanged } = useHapticFeedback();

  const [skin, setSkin] = useState(5);
  const [sleep, setSleep] = useState(3);
  const [pain, setPain] = useState(5);
  const [mood, setMood] = useState(3);
  const [triggers, setTriggers] = useState('');

  const handleSkip = async () => {
    await impact('light');
    skipOnboarding();
    navigate('/auth');
  };

  const handleBack = async () => {
    await impact('light');
    prevScreen();
  };

  const handleMoodSelect = async (value: number) => {
    await selectionChanged();
    setMood(value);
  };

  const handleSleepSelect = async (value: number) => {
    await selectionChanged();
    setSleep(value);
  };

  const handleContinue = async () => {
    await impact('medium');
    setFirstLog({
      skin,
      sleep,
      pain,
      mood,
      triggers,
    });
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
          className="space-y-5 py-4"
        >
          {/* Headlines */}
          <div className="space-y-1">
            <motion.h1 
              className="font-display text-2xl md:text-3xl font-bold text-foreground leading-tight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              Log your first day
            </motion.h1>
            <motion.div 
              className="flex items-center gap-2 text-muted-foreground"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
            >
              <Sun className="w-4 h-4 text-healing" />
              <span className="text-sm">Takes 30 seconds</span>
            </motion.div>
          </div>

          {/* Skin condition slider */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Skin condition</span>
                <span className="text-lg font-bold text-foreground">{skin}/10</span>
              </div>
              <Slider
                value={[skin]}
                onValueChange={([v]) => setSkin(v)}
                min={1}
                max={10}
                step={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Worst</span>
                <span>Best</span>
              </div>
            </Card>
          </motion.div>

          {/* Sleep quality */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
          >
            <Card className="p-4 space-y-3">
              <span className="text-sm font-medium text-foreground">Sleep quality</span>
              <div className="flex justify-between gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    onClick={() => handleSleepSelect(value)}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-lg transition-all min-h-[44px]',
                      sleep === value
                        ? 'bg-primary text-primary-foreground scale-105'
                        : 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    {'⭐'.repeat(value)}
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Pain level slider */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Pain level</span>
                <span className="text-lg font-bold text-foreground">{pain}/10</span>
              </div>
              <Slider
                value={[pain]}
                onValueChange={([v]) => setPain(v)}
                min={1}
                max={10}
                step={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>None</span>
                <span>Severe</span>
              </div>
            </Card>
          </motion.div>

          {/* Mood selector */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            <Card className="p-4 space-y-3">
              <span className="text-sm font-medium text-foreground">Mood</span>
              <div className="flex justify-between gap-2">
                {moodEmojis.map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => handleMoodSelect(i + 1)}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-2xl transition-all min-h-[44px]',
                      mood === i + 1
                        ? 'bg-primary/20 scale-110 ring-2 ring-primary'
                        : 'bg-muted hover:bg-muted/80'
                    )}
                    aria-label={moodLabels[i]}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Triggers input */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            <Card className="p-4 space-y-2">
              <span className="text-sm font-medium text-foreground">Any triggers today? (optional)</span>
              <Input
                value={triggers}
                onChange={(e) => setTriggers(e.target.value)}
                placeholder="e.g., dairy, stress, weather"
                className="h-12"
              />
            </Card>
          </motion.div>
        </motion.div>
      </div>

      {/* Footer with progress and CTA */}
      <div className="px-6 pb-6 space-y-4" style={{ paddingBottom: 'calc(var(--safe-bottom) + 1.5rem)' }}>
        <OnboardingProgress current={4} total={5} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <Button 
            onClick={handleContinue}
            className="w-full h-14 text-base font-semibold"
            variant="action"
          >
            Save Day 1
          </Button>
        </motion.div>
      </div>
    </div>
  );
};
