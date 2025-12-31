import { useMemo } from 'react';
import { useUserData } from '@/contexts/UserDataContext';
import { analyzeFlareState, FlareAnalysis } from '@/utils/flareStateEngine';

/**
 * Hook to get the current flare state analysis for the logged-in user.
 * Computes flare detection from check-in data.
 */
export function useFlareState(): FlareAnalysis & { isLoading: boolean } {
  const { checkIns, isLoading } = useUserData();
  
  const analysis = useMemo(() => {
    if (checkIns.length === 0) {
      return {
        dailyBurdens: [],
        baselineBurdenScore: null,
        flareThreshold: null,
        flareEpisodes: [],
        dailyFlareStates: [],
        currentState: 'stable' as const,
        isInActiveFlare: false,
        currentFlareDuration: null,
      };
    }
    
    // Transform check-ins to the format expected by the engine
    const checkInData = checkIns.map(c => ({
      id: c.id,
      created_at: c.timestamp,
      skinIntensity: c.skinIntensity,
      skinFeeling: c.skinFeeling,
      symptomsExperienced: c.symptomsExperienced?.map(s => ({
        name: s.symptom,
        severity: s.severity,
      })),
    }));
    
    return analyzeFlareState(checkInData);
  }, [checkIns]);
  
  return {
    ...analysis,
    isLoading,
  };
}

/**
 * Get a human-readable label for a flare state
 */
export function getFlareStateLabel(state: FlareAnalysis['currentState']): string {
  switch (state) {
    case 'stable':
      return 'Stable';
    case 'pre_flare':
      return 'Pre-flare';
    case 'active_flare':
      return 'Active flare';
    case 'peak_flare':
      return 'Peak flare';
    case 'resolving_flare':
      return 'Resolving';
    default:
      return 'Unknown';
  }
}

/**
 * Get a color class for a flare state (using semantic tokens)
 */
export function getFlareStateColor(state: FlareAnalysis['currentState']): string {
  switch (state) {
    case 'stable':
      return 'text-green-600 dark:text-green-400';
    case 'pre_flare':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'active_flare':
      return 'text-orange-600 dark:text-orange-400';
    case 'peak_flare':
      return 'text-red-600 dark:text-red-400';
    case 'resolving_flare':
      return 'text-blue-600 dark:text-blue-400';
    default:
      return 'text-muted-foreground';
  }
}
