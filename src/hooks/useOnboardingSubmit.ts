import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOnboarding, OnboardingData } from '@/contexts/OnboardingContext';

const ONBOARDING_VERSION = '1.0';

/**
 * Hook to handle submitting onboarding data ONLY after successful account creation.
 * 
 * IMPORTANT: This implements strict gating - onboarding answers are stored locally
 * during the onboarding flow and ONLY sent to the backend after account creation succeeds.
 * 
 * If signup fails or user abandons, NO data is persisted to the backend.
 */
export const useOnboardingSubmit = () => {
  const { getOnboardingData, clearOnboardingData, completeOnboarding } = useOnboarding();

  /**
   * Submit onboarding data to the backend.
   * Should ONLY be called after successful account creation.
   * 
   * @param userId - The authenticated user's ID
   * @returns Promise<boolean> - true if successful, false otherwise
   */
  const submitOnboardingData = useCallback(async (userId: string): Promise<boolean> => {
    const onboardingData = getOnboardingData();
    
    // If no onboarding data exists (user skipped or none collected), just complete
    if (!onboardingData || (!onboardingData.tswDuration && !onboardingData.goal && !onboardingData.firstLog)) {
      console.log('[useOnboardingSubmit] No onboarding data to submit');
      completeOnboarding();
      clearOnboardingData();
      return true;
    }

    try {
      console.log('[useOnboardingSubmit] Submitting onboarding data for user:', userId);
      
      const { data, error } = await supabase.functions.invoke('save-onboarding', {
        body: {
          onboardingData,
          onboardingVersion: ONBOARDING_VERSION,
        },
      });

      if (error) {
        console.error('[useOnboardingSubmit] Failed to save onboarding data:', error);
        // Don't block the user - onboarding save failure shouldn't prevent account creation
        // We still clear local data and complete onboarding
        completeOnboarding();
        clearOnboardingData();
        return false;
      }

      console.log('[useOnboardingSubmit] Successfully saved onboarding data:', data);
      
      // Clear local storage after successful backend save
      completeOnboarding();
      clearOnboardingData();
      
      return true;
    } catch (error) {
      console.error('[useOnboardingSubmit] Unexpected error:', error);
      // Don't block the user
      completeOnboarding();
      clearOnboardingData();
      return false;
    }
  }, [getOnboardingData, clearOnboardingData, completeOnboarding]);

  /**
   * Check if there's pending onboarding data to submit.
   */
  const hasPendingOnboardingData = useCallback((): boolean => {
    const data = getOnboardingData();
    return !!(data && (data.tswDuration || data.goal || data.firstLog));
  }, [getOnboardingData]);

  return {
    submitOnboardingData,
    hasPendingOnboardingData,
    onboardingVersion: ONBOARDING_VERSION,
  };
};