import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ONBOARDING_VERSION = '1.0';

// Keep these in sync with src/contexts/OnboardingContext.tsx
const STORAGE_KEY_SEEN = 'hasSeenOnboarding';
const STORAGE_KEY_DATA = 'onboardingData';

type LocalOnboardingData = {
  tswDuration: string | null;
  goal: string | null;
  initialSeverity: number | null;
  firstLog: {
    skin: number;
    sleep: number;
    pain: number;
    mood: number;
    triggers: string;
  } | null;
};

const readLocalOnboardingData = (): LocalOnboardingData | null => {
  const stored = localStorage.getItem(STORAGE_KEY_DATA);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as LocalOnboardingData;
  } catch {
    return null;
  }
};

const clearLocalOnboardingData = () => {
  localStorage.removeItem(STORAGE_KEY_DATA);
};

const markOnboardingSeen = () => {
  localStorage.setItem(STORAGE_KEY_SEEN, 'true');
};

/**
 * Submits onboarding data ONLY after successful account creation.
 *
 * Boundary enforcement:
 * - Before signup: answers live only in localStorage (STORAGE_KEY_DATA).
 * - After signup success: we send to backend, then clear localStorage.
 */
export const useOnboardingSubmit = () => {
  const submitOnboardingData = useCallback(async (userId: string): Promise<boolean> => {
    const onboardingData = readLocalOnboardingData();

    // If no onboarding data exists, just clean up local state.
    if (!onboardingData) {
      markOnboardingSeen();
      clearLocalOnboardingData();
      return true;
    }

    const hasAnyAnswers =
      !!onboardingData.tswDuration ||
      !!onboardingData.goal ||
      onboardingData.initialSeverity !== null ||
      !!onboardingData.firstLog;

    if (!hasAnyAnswers) {
      markOnboardingSeen();
      clearLocalOnboardingData();
      return true;
    }

    try {
      const { error } = await supabase.functions.invoke('save-onboarding', {
        body: {
          onboardingData,
          onboardingVersion: ONBOARDING_VERSION,
        },
      });

      // Whether or not backend save succeeds, we should NOT block account creation.
      // We still clear local answers to avoid accidental later submission.
      markOnboardingSeen();
      clearLocalOnboardingData();

      if (error) {
        console.error('[useOnboardingSubmit] Failed to save onboarding data:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[useOnboardingSubmit] Unexpected error:', err);
      markOnboardingSeen();
      clearLocalOnboardingData();
      return false;
    }
  }, []);

  const hasPendingOnboardingData = useCallback((): boolean => {
    const data = readLocalOnboardingData();
    if (!data) return false;
    return !!(data.tswDuration || data.goal || data.initialSeverity !== null || data.firstLog);
  }, []);

  return {
    submitOnboardingData,
    hasPendingOnboardingData,
    onboardingVersion: ONBOARDING_VERSION,
  };
};
