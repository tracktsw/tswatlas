import { useMemo } from 'react';
import { useUserData } from '@/contexts/UserDataContext';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { analyzeFlareState, FlareAnalysis, BaselineConfidence, FlareState } from '@/utils/flareStateEngine';

/**
 * Hook to get the current flare state analysis for the logged-in user.
 * Computes flare detection from check-in data (including demo data if active).
 */
export function useFlareState(): FlareAnalysis & { isLoading: boolean } {
  const { checkIns, isLoading } = useUserData();
  const { getEffectiveCheckIns } = useDemoMode();
  
  // Use effective check-ins which includes demo data when demo mode is active
  const effectiveCheckIns = useMemo(() => getEffectiveCheckIns(checkIns), [checkIns, getEffectiveCheckIns]);
  
  const analysis = useMemo(() => {
    if (effectiveCheckIns.length === 0) {
      return {
        dailyBurdens: [],
        baselineBurdenScore: null,
        baselineConfidence: 'early' as BaselineConfidence,
        flareThreshold: null,
        flareEpisodes: [],
        dailyFlareStates: [],
        currentState: 'stable' as FlareState,
        isInActiveFlare: false,
        currentFlareDuration: null,
      };
    }
    
    // Transform check-ins to the format expected by the engine
    const checkInData = effectiveCheckIns.map(c => ({
      id: c.id,
      created_at: c.timestamp,
      skinIntensity: c.skinIntensity,
      skinFeeling: c.skinFeeling,
      symptomsExperienced: c.symptomsExperienced?.map(s => ({
        name: s.symptom,
        severity: s.severity,
      })),
      pain_score: c.painScore,
      sleep_score: c.sleepScore,
      mood: c.mood,
    }));
    
    return analyzeFlareState(checkInData);
  }, [effectiveCheckIns]);
  
  return {
    ...analysis,
    isLoading,
  };
}

/**
 * Get a human-readable label for a flare state
 */
export function getFlareStateLabel(state: FlareState): string {
  switch (state) {
    case 'stable':
      return 'Stable';
    case 'stable_severe':
      return 'Stable – Severe';
    case 'active_flare':
      return 'Active Flare';
    case 'recovering':
      return 'Recovering';
    default:
      return 'Unknown';
  }
}

/**
 * Get a human-readable label for baseline confidence
 */
export function getConfidenceLabel(confidence: BaselineConfidence): string {
  switch (confidence) {
    case 'early':
      return 'Learning';
    case 'provisional':
      return 'Provisional';
    case 'mature':
      return 'Established';
    default:
      return 'Unknown';
  }
}

/**
 * Get a color class for a flare state (using semantic tokens)
 */
export function getFlareStateColor(state: FlareState): string {
  switch (state) {
    case 'stable':
      return 'text-green-600 dark:text-green-400';
    case 'stable_severe':
      return 'text-amber-600 dark:text-amber-400';
    case 'active_flare':
      return 'text-orange-600 dark:text-orange-400';
    case 'recovering':
      return 'text-blue-600 dark:text-blue-400';
    default:
      return 'text-muted-foreground';
  }
}
