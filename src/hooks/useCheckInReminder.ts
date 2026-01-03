import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const DEBUG_REMINDERS = false;

function log(...args: unknown[]) {
  if (DEBUG_REMINDERS) {
    console.log('[REMINDER]', ...args);
  }
}

export interface ReminderState {
  enabled: boolean;
  morningTime: string; // "HH:MM"
  eveningTime: string; // "HH:MM"
  lastRemindedAt: string | null;
  snoozedUntil: string | null;
  timezone: string | null;
}

interface UseCheckInReminderOptions {
  reminderSettings: {
    enabled: boolean;
    morningTime: string;
    eveningTime: string;
  };
  checkIns: Array<{ timestamp: string; timeOfDay: 'morning' | 'evening' }>;
  userId: string | null;
}

interface UseCheckInReminderReturn {
  shouldShowReminder: boolean;
  reminderType: 'morning' | 'evening' | null;
  nextReminderTime: Date | null;
  dismissReminder: () => Promise<void>;
  snoozeReminder: (hours?: number) => Promise<void>;
  isLoading: boolean;
}

const SNOOZE_HOURS = 1;
const MIN_HOURS_BETWEEN_REMINDERS = 4;

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

function getScheduledTime(timeStr: string, date: Date = new Date()): Date {
  const { hours, minutes } = parseTime(timeStr);
  const scheduled = new Date(date);
  scheduled.setHours(hours, minutes, 0, 0);
  return scheduled;
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function hasCheckedInToday(
  checkIns: Array<{ timestamp: string; timeOfDay: 'morning' | 'evening' }>,
  timeOfDay: 'morning' | 'evening'
): boolean {
  return checkIns.some(checkIn => {
    const checkInDate = new Date(checkIn.timestamp);
    return isToday(checkInDate) && checkIn.timeOfDay === timeOfDay;
  });
}

export function useCheckInReminder({
  reminderSettings,
  checkIns,
  userId,
}: UseCheckInReminderOptions): UseCheckInReminderReturn {
  const [shouldShowReminder, setShouldShowReminder] = useState(false);
  const [reminderType, setReminderType] = useState<'morning' | 'evening' | null>(null);
  const [nextReminderTime, setNextReminderTime] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reminderState, setReminderState] = useState<{
    lastRemindedAt: string | null;
    snoozedUntil: string | null;
  }>({ lastRemindedAt: null, snoozedUntil: null });

  const hasEvaluated = useRef(false);

  // Load reminder state from database
  const loadReminderState = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('last_reminded_at, snoozed_until, timezone')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setReminderState({
          lastRemindedAt: data.last_reminded_at,
          snoozedUntil: data.snoozed_until,
        });
        log('Loaded reminder state:', {
          lastRemindedAt: data.last_reminded_at,
          snoozedUntil: data.snoozed_until,
        });
      }
    } catch (error) {
      console.error('Error loading reminder state:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Evaluate whether to show reminder
  const evaluateReminder = useCallback(() => {
    if (!reminderSettings.enabled) {
      log('Reminders disabled, not showing');
      setShouldShowReminder(false);
      setReminderType(null);
      calculateNextReminder();
      return;
    }

    const now = new Date();
    log('Evaluating reminder at:', now.toISOString());

    // Check if snoozed
    if (reminderState.snoozedUntil) {
      const snoozedUntil = new Date(reminderState.snoozedUntil);
      if (now < snoozedUntil) {
        log('Still snoozed until:', snoozedUntil.toISOString());
        setShouldShowReminder(false);
        setNextReminderTime(snoozedUntil);
        return;
      }
    }

    // Check if we reminded too recently (spam prevention)
    if (reminderState.lastRemindedAt) {
      const lastReminded = new Date(reminderState.lastRemindedAt);
      const hoursSinceLastReminder = (now.getTime() - lastReminded.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastReminder < MIN_HOURS_BETWEEN_REMINDERS) {
        log(`Reminded ${hoursSinceLastReminder.toFixed(1)}h ago, waiting for ${MIN_HOURS_BETWEEN_REMINDERS}h gap`);
        setShouldShowReminder(false);
        calculateNextReminder();
        return;
      }
    }

    // Get scheduled times for today
    const morningTime = getScheduledTime(reminderSettings.morningTime);
    const eveningTime = getScheduledTime(reminderSettings.eveningTime);

    log('Morning scheduled:', morningTime.toISOString());
    log('Evening scheduled:', eveningTime.toISOString());

    // Determine which reminder period we're in
    const isAfterMorning = now >= morningTime;
    const isAfterEvening = now >= eveningTime;

    let shouldPrompt = false;
    let promptType: 'morning' | 'evening' | null = null;

    // Check evening first (higher priority if both are due)
    if (isAfterEvening) {
      const eveningDone = hasCheckedInToday(checkIns, 'evening');
      log('Evening period - checked in:', eveningDone);
      if (!eveningDone) {
        shouldPrompt = true;
        promptType = 'evening';
      }
    } else if (isAfterMorning) {
      const morningDone = hasCheckedInToday(checkIns, 'morning');
      log('Morning period - checked in:', morningDone);
      if (!morningDone) {
        shouldPrompt = true;
        promptType = 'morning';
      }
    } else {
      log('Before any scheduled reminder time');
    }

    log('Decision:', { shouldPrompt, promptType });
    setShouldShowReminder(shouldPrompt);
    setReminderType(promptType);
    calculateNextReminder();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminderSettings, checkIns, reminderState]);

  // Calculate next reminder time for display
  const calculateNextReminder = useCallback(() => {
    if (!reminderSettings.enabled) {
      setNextReminderTime(null);
      return;
    }

    const now = new Date();
    const morningToday = getScheduledTime(reminderSettings.morningTime);
    const eveningToday = getScheduledTime(reminderSettings.eveningTime);
    const morningTomorrow = new Date(morningToday);
    morningTomorrow.setDate(morningTomorrow.getDate() + 1);

    let next: Date;

    if (now < morningToday) {
      next = morningToday;
    } else if (now < eveningToday) {
      next = eveningToday;
    } else {
      next = morningTomorrow;
    }

    log('Next reminder calculated:', next.toISOString());
    setNextReminderTime(next);
  }, [reminderSettings]);

  // Update last_reminded_at after showing
  const markReminderShown = useCallback(async () => {
    if (!userId) return;

    try {
      const now = new Date().toISOString();
      await supabase
        .from('user_settings')
        .update({ last_reminded_at: now, snoozed_until: null })
        .eq('user_id', userId);

      setReminderState(prev => ({
        ...prev,
        lastRemindedAt: now,
        snoozedUntil: null,
      }));
      log('Marked reminder as shown at:', now);
    } catch (error) {
      console.error('Error updating reminder state:', error);
    }
  }, [userId]);

  // Dismiss reminder (marks as shown)
  const dismissReminder = useCallback(async () => {
    log('Dismissing reminder');
    setShouldShowReminder(false);
    await markReminderShown();
  }, [markReminderShown]);

  // Snooze reminder
  const snoozeReminder = useCallback(async (hours: number = SNOOZE_HOURS) => {
    if (!userId) return;

    const snoozedUntil = new Date();
    snoozedUntil.setHours(snoozedUntil.getHours() + hours);

    log('Snoozing until:', snoozedUntil.toISOString());

    try {
      await supabase
        .from('user_settings')
        .update({ snoozed_until: snoozedUntil.toISOString() })
        .eq('user_id', userId);

      setReminderState(prev => ({
        ...prev,
        snoozedUntil: snoozedUntil.toISOString(),
      }));
      setShouldShowReminder(false);
      setNextReminderTime(snoozedUntil);
    } catch (error) {
      console.error('Error snoozing reminder:', error);
    }
  }, [userId]);

  // Load state on mount
  useEffect(() => {
    loadReminderState();
  }, [loadReminderState]);

  // Evaluate on load and when dependencies change
  useEffect(() => {
    if (isLoading) return;

    // Evaluate immediately
    evaluateReminder();

    // Also mark that we showed it if needed
    if (shouldShowReminder && !hasEvaluated.current) {
      hasEvaluated.current = true;
      markReminderShown();
    }
  }, [isLoading, evaluateReminder, shouldShowReminder, markReminderShown]);

  // Re-evaluate on visibility change (when app comes to foreground)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        hasEvaluated.current = false; // Allow re-evaluation
        loadReminderState().then(() => {
          evaluateReminder();
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadReminderState, evaluateReminder]);

  return {
    shouldShowReminder,
    reminderType,
    nextReminderTime,
    dismissReminder,
    snoozeReminder,
    isLoading,
  };
}
