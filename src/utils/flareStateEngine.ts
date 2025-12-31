/**
 * Flare State Engine
 * 
 * System-derived flare detection based on sustained symptom burden over time.
 * This logic is transparent, explainable, and independent of user's subjective selections.
 */

// Symptom weights for burden calculation
const SYMPTOM_WEIGHTS: Record<string, number> = {
  itching: 2,
  burning: 2,
  thermodysregulation: 2,
  redness: 1,
  swelling: 1,
  flaking: 1,
  oozing: 3,
  insomnia: 3,
};

export type FlareState = 
  | 'stable' 
  | 'pre_flare' 
  | 'active_flare' 
  | 'peak_flare' 
  | 'resolving_flare';

export interface DailyBurden {
  date: string;
  score: number;
  skinIntensity: number;
  symptomScore: number;
}

export interface FlareEpisode {
  startDate: string;
  endDate: string | null;
  peakDate: string;
  durationDays: number;
  peakBurdenScore: number;
  isActive: boolean;
}

export interface DailyFlareState {
  date: string;
  burdenScore: number;
  rollingAverage3d: number | null;
  flareState: FlareState;
  isInFlareEpisode: boolean;
}

export interface FlareAnalysis {
  dailyBurdens: DailyBurden[];
  baselineBurdenScore: number | null;
  flareThreshold: number | null;
  flareEpisodes: FlareEpisode[];
  dailyFlareStates: DailyFlareState[];
  currentState: FlareState;
  isInActiveFlare: boolean;
  currentFlareDuration: number | null;
}

interface CheckInData {
  id: string;
  created_at: string;
  skinIntensity?: number;
  skinFeeling: number;
  symptomsExperienced?: Array<{ name: string; severity: number }>;
}

/**
 * Calculate daily flare burden score from a check-in
 */
export function calculateDailyBurdenScore(checkIn: CheckInData): number {
  // Get skin intensity (use stored value or derive from skinFeeling)
  const skinIntensity = checkIn.skinIntensity ?? (5 - checkIn.skinFeeling);
  
  // Calculate symptom weights
  let symptomScore = 0;
  if (checkIn.symptomsExperienced && Array.isArray(checkIn.symptomsExperienced)) {
    for (const symptom of checkIn.symptomsExperienced) {
      const normalizedName = symptom.name.toLowerCase().replace(/\s+/g, '');
      const weight = SYMPTOM_WEIGHTS[normalizedName] ?? 0;
      // Only count if symptom was selected (severity > 0)
      if (symptom.severity > 0) {
        symptomScore += weight;
      }
    }
  }
  
  return skinIntensity + symptomScore;
}

/**
 * Group check-ins by date and calculate daily burden scores
 */
export function calculateDailyBurdens(checkIns: CheckInData[]): DailyBurden[] {
  // Group check-ins by date
  const byDate = new Map<string, CheckInData[]>();
  
  for (const checkIn of checkIns) {
    const date = checkIn.created_at.split('T')[0];
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(checkIn);
  }
  
  // Calculate daily burden (use highest score if multiple check-ins per day)
  const dailyBurdens: DailyBurden[] = [];
  
  for (const [date, dayCheckIns] of byDate) {
    let maxScore = 0;
    let maxSkinIntensity = 0;
    let maxSymptomScore = 0;
    
    for (const checkIn of dayCheckIns) {
      const skinIntensity = checkIn.skinIntensity ?? (5 - checkIn.skinFeeling);
      let symptomScore = 0;
      
      if (checkIn.symptomsExperienced && Array.isArray(checkIn.symptomsExperienced)) {
        for (const symptom of checkIn.symptomsExperienced) {
          const normalizedName = symptom.name.toLowerCase().replace(/\s+/g, '');
          const weight = SYMPTOM_WEIGHTS[normalizedName] ?? 0;
          if (symptom.severity > 0) {
            symptomScore += weight;
          }
        }
      }
      
      const score = skinIntensity + symptomScore;
      if (score > maxScore) {
        maxScore = score;
        maxSkinIntensity = skinIntensity;
        maxSymptomScore = symptomScore;
      }
    }
    
    dailyBurdens.push({
      date,
      score: maxScore,
      skinIntensity: maxSkinIntensity,
      symptomScore: maxSymptomScore,
    });
  }
  
  // Sort by date ascending
  return dailyBurdens.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate personal baseline from last 30-45 days
 * Baseline = median of lowest 25% of scores
 */
export function calculateBaselineBurdenScore(dailyBurdens: DailyBurden[]): number | null {
  if (dailyBurdens.length < 7) {
    // Need at least a week of data for meaningful baseline
    return null;
  }
  
  // Get last 30-45 days of data
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 45);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];
  
  const recentBurdens = dailyBurdens.filter(b => b.date >= cutoffStr);
  
  if (recentBurdens.length < 7) {
    // Fall back to all available data if not enough recent data
    return calculateBaselineFromScores(dailyBurdens.map(b => b.score));
  }
  
  return calculateBaselineFromScores(recentBurdens.map(b => b.score));
}

function calculateBaselineFromScores(scores: number[]): number | null {
  if (scores.length === 0) return null;
  
  // Sort ascending
  const sorted = [...scores].sort((a, b) => a - b);
  
  // Take lowest 25%
  const lowest25PercentCount = Math.max(1, Math.floor(sorted.length * 0.25));
  const lowest25Percent = sorted.slice(0, lowest25PercentCount);
  
  // Return median of lowest 25%
  const mid = Math.floor(lowest25Percent.length / 2);
  if (lowest25Percent.length % 2 === 0) {
    return (lowest25Percent[mid - 1] + lowest25Percent[mid]) / 2;
  }
  return lowest25Percent[mid];
}

/**
 * Calculate 3-day rolling average for a specific date
 */
export function calculate3DayRollingAverage(
  dailyBurdens: DailyBurden[],
  dateIndex: number
): number | null {
  if (dateIndex < 2) return null;
  
  const scores = [
    dailyBurdens[dateIndex].score,
    dailyBurdens[dateIndex - 1].score,
    dailyBurdens[dateIndex - 2].score,
  ];
  
  return scores.reduce((a, b) => a + b, 0) / 3;
}

/**
 * Detect flare episodes based on rolling average exceeding threshold
 */
export function detectFlareEpisodes(
  dailyBurdens: DailyBurden[],
  flareThreshold: number
): FlareEpisode[] {
  if (dailyBurdens.length < 3) return [];
  
  const episodes: FlareEpisode[] = [];
  let currentEpisode: {
    startIndex: number;
    peakIndex: number;
    peakScore: number;
    consecutiveAbove: number;
  } | null = null;
  let consecutiveBelow = 0;
  
  for (let i = 2; i < dailyBurdens.length; i++) {
    const rollingAvg = calculate3DayRollingAverage(dailyBurdens, i);
    if (rollingAvg === null) continue;
    
    const isAboveThreshold = rollingAvg > flareThreshold;
    
    if (isAboveThreshold) {
      consecutiveBelow = 0;
      
      if (currentEpisode === null) {
        currentEpisode = {
          startIndex: i,
          peakIndex: i,
          peakScore: dailyBurdens[i].score,
          consecutiveAbove: 1,
        };
      } else {
        currentEpisode.consecutiveAbove++;
        if (dailyBurdens[i].score > currentEpisode.peakScore) {
          currentEpisode.peakScore = dailyBurdens[i].score;
          currentEpisode.peakIndex = i;
        }
      }
    } else {
      if (currentEpisode !== null) {
        consecutiveBelow++;
        
        // Flare ends after 2 consecutive days below threshold
        if (consecutiveBelow >= 2) {
          // Only count as flare if it lasted at least 2 consecutive days above threshold
          if (currentEpisode.consecutiveAbove >= 2) {
            const endIndex = i - consecutiveBelow;
            episodes.push({
              startDate: dailyBurdens[currentEpisode.startIndex].date,
              endDate: dailyBurdens[endIndex].date,
              peakDate: dailyBurdens[currentEpisode.peakIndex].date,
              durationDays: endIndex - currentEpisode.startIndex + 1,
              peakBurdenScore: currentEpisode.peakScore,
              isActive: false,
            });
          }
          currentEpisode = null;
          consecutiveBelow = 0;
        }
      }
    }
  }
  
  // Handle ongoing flare at end of data
  if (currentEpisode !== null && currentEpisode.consecutiveAbove >= 2) {
    const lastIndex = dailyBurdens.length - 1;
    episodes.push({
      startDate: dailyBurdens[currentEpisode.startIndex].date,
      endDate: null, // Still active
      peakDate: dailyBurdens[currentEpisode.peakIndex].date,
      durationDays: lastIndex - currentEpisode.startIndex + 1,
      peakBurdenScore: currentEpisode.peakScore,
      isActive: true,
    });
  }
  
  return episodes;
}

/**
 * Assign flare state to each day
 */
export function assignDailyFlareStates(
  dailyBurdens: DailyBurden[],
  baselineBurdenScore: number | null,
  flareThreshold: number | null,
  flareEpisodes: FlareEpisode[]
): DailyFlareState[] {
  const states: DailyFlareState[] = [];
  
  // Build a map of dates to their episode (if any)
  const dateToEpisode = new Map<string, FlareEpisode>();
  for (const episode of flareEpisodes) {
    const startDate = new Date(episode.startDate);
    const endDate = episode.endDate ? new Date(episode.endDate) : new Date();
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      dateToEpisode.set(dateStr, episode);
    }
  }
  
  // Get peak scores within each episode for top 20% calculation
  const episodePeakThresholds = new Map<FlareEpisode, number>();
  for (const episode of flareEpisodes) {
    const episodeScores = dailyBurdens
      .filter(b => {
        const bDate = new Date(b.date);
        const startDate = new Date(episode.startDate);
        const endDate = episode.endDate ? new Date(episode.endDate) : new Date();
        return bDate >= startDate && bDate <= endDate;
      })
      .map(b => b.score)
      .sort((a, b) => b - a);
    
    const top20Index = Math.max(0, Math.floor(episodeScores.length * 0.2) - 1);
    episodePeakThresholds.set(episode, episodeScores[top20Index] ?? episode.peakBurdenScore);
  }
  
  for (let i = 0; i < dailyBurdens.length; i++) {
    const burden = dailyBurdens[i];
    const rollingAvg = calculate3DayRollingAverage(dailyBurdens, i);
    const episode = dateToEpisode.get(burden.date);
    
    let flareState: FlareState = 'stable';
    
    if (episode) {
      // Check if this is a peak day (top 20% within episode)
      const peakThreshold = episodePeakThresholds.get(episode) ?? episode.peakBurdenScore;
      if (burden.score >= peakThreshold) {
        flareState = 'peak_flare';
      } else {
        flareState = 'active_flare';
      }
    } else if (baselineBurdenScore !== null && flareThreshold !== null) {
      // Check for resolving flare (episode just ended, scores decreasing)
      const recentEpisode = flareEpisodes.find(ep => {
        if (!ep.endDate) return false;
        const endDate = new Date(ep.endDate);
        const burdenDate = new Date(burden.date);
        const daysSinceEnd = Math.floor((burdenDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceEnd > 0 && daysSinceEnd <= 5;
      });
      
      if (recentEpisode && i >= 2) {
        const isDecreasing = 
          dailyBurdens[i].score < dailyBurdens[i - 1].score &&
          dailyBurdens[i - 1].score < dailyBurdens[i - 2].score;
        if (isDecreasing) {
          flareState = 'resolving_flare';
        }
      }
      
      // Check for pre-flare (rising but not yet in flare)
      if (flareState === 'stable' && i >= 2 && rollingAvg !== null) {
        const isRising = 
          dailyBurdens[i].score > dailyBurdens[i - 1].score &&
          dailyBurdens[i - 1].score > dailyBurdens[i - 2].score;
        
        if (isRising && rollingAvg < flareThreshold && burden.score > baselineBurdenScore) {
          flareState = 'pre_flare';
        }
      }
      
      // Stable if score <= baseline and no flare
      if (flareState === 'stable' && burden.score > baselineBurdenScore) {
        // Score is above baseline but not in pattern - still stable but elevated
        flareState = 'stable';
      }
    }
    
    states.push({
      date: burden.date,
      burdenScore: burden.score,
      rollingAverage3d: rollingAvg,
      flareState,
      isInFlareEpisode: !!episode,
    });
  }
  
  return states;
}

/**
 * Main analysis function - computes complete flare analysis from check-ins
 */
export function analyzeFlareState(checkIns: CheckInData[]): FlareAnalysis {
  // Calculate daily burdens
  const dailyBurdens = calculateDailyBurdens(checkIns);
  
  // Calculate baseline
  const baselineBurdenScore = calculateBaselineBurdenScore(dailyBurdens);
  
  // Calculate flare threshold (baseline × 1.5)
  const flareThreshold = baselineBurdenScore !== null 
    ? baselineBurdenScore * 1.5 
    : null;
  
  // Detect flare episodes
  const flareEpisodes = flareThreshold !== null
    ? detectFlareEpisodes(dailyBurdens, flareThreshold)
    : [];
  
  // Assign daily flare states
  const dailyFlareStates = assignDailyFlareStates(
    dailyBurdens,
    baselineBurdenScore,
    flareThreshold,
    flareEpisodes
  );
  
  // Determine current state
  const currentState = dailyFlareStates.length > 0
    ? dailyFlareStates[dailyFlareStates.length - 1].flareState
    : 'stable';
  
  // Check if currently in active flare
  const activeFlare = flareEpisodes.find(ep => ep.isActive);
  const isInActiveFlare = !!activeFlare;
  const currentFlareDuration = activeFlare?.durationDays ?? null;
  
  return {
    dailyBurdens,
    baselineBurdenScore,
    flareThreshold,
    flareEpisodes,
    dailyFlareStates,
    currentState,
    isInActiveFlare,
    currentFlareDuration,
  };
}
