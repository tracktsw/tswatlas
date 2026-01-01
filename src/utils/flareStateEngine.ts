/**
 * Flare State Engine (Simplified Edition)
 * 
 * Algorithm:
 * - dailySeverity = average symptom severity for each day
 * - rollingBaseline = average dailySeverity over previous 14 days
 * - Flare starts when dailySeverity >= baseline + 0.5 for ≥3 consecutive days
 * - Peak flare day = day with highest dailySeverity within that flare window
 */

export type FlareState = 
  | 'stable' 
  | 'pre_flare' 
  | 'active_flare' 
  | 'peak_flare' 
  | 'resolving_flare';

export type BaselineConfidence = 'early' | 'provisional' | 'mature';

export interface DailyBurden {
  date: string;
  score: number; // dailySeverity = average symptom severity
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
  isPaused: boolean;
}

export interface DailyFlareState {
  date: string;
  burdenScore: number;
  rollingAverage3: number | null; // kept for compatibility, but we use 14-day baseline now
  flareState: FlareState;
  isInFlareEpisode: boolean;
}

export interface FlareAnalysis {
  dailyBurdens: DailyBurden[];
  baselineBurdenScore: number | null;
  baselineConfidence: BaselineConfidence;
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
 * Calculate daily severity from a check-in
 * dailySeverity = average of all symptom severities (0-3 scale each)
 */
function calculateDailySeverity(checkIn: CheckInData): number {
  const symptoms = checkIn.symptomsExperienced ?? [];
  
  if (symptoms.length === 0) {
    // Fall back to skin intensity/feeling if no symptoms
    const skinIntensity = checkIn.skinIntensity ?? (5 - checkIn.skinFeeling);
    return skinIntensity; // 0-5 scale
  }
  
  // Average severity of all symptoms (each symptom is 0-3)
  const totalSeverity = symptoms.reduce((sum, s) => sum + s.severity, 0);
  const avgSeverity = totalSeverity / symptoms.length;
  
  // Include skin intensity in the average for a more complete picture
  const skinIntensity = checkIn.skinIntensity ?? (5 - checkIn.skinFeeling);
  // Normalize skin intensity (0-5) to same scale as symptoms (0-3)
  const normalizedSkin = (skinIntensity / 5) * 3;
  
  return (avgSeverity + normalizedSkin) / 2;
}

/**
 * Group check-ins by date and calculate daily severity scores
 */
export function calculateDailyBurdens(checkIns: CheckInData[]): DailyBurden[] {
  const byDate = new Map<string, CheckInData[]>();
  
  for (const checkIn of checkIns) {
    const date = checkIn.created_at.split('T')[0];
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(checkIn);
  }
  
  const dailyBurdens: DailyBurden[] = [];
  
  for (const [date, dayCheckIns] of byDate) {
    // Average severity across all check-ins for the day
    let totalSeverity = 0;
    let maxSkinIntensity = 0;
    let maxSymptomScore = 0;
    
    for (const checkIn of dayCheckIns) {
      totalSeverity += calculateDailySeverity(checkIn);
      
      const skinIntensity = checkIn.skinIntensity ?? (5 - checkIn.skinFeeling);
      maxSkinIntensity = Math.max(maxSkinIntensity, skinIntensity);
      
      const symptoms = checkIn.symptomsExperienced ?? [];
      const symptomTotal = symptoms.reduce((sum, s) => sum + s.severity, 0);
      maxSymptomScore = Math.max(maxSymptomScore, symptomTotal);
    }
    
    const avgSeverity = totalSeverity / dayCheckIns.length;
    
    dailyBurdens.push({
      date,
      score: avgSeverity, // This is now the dailySeverity
      skinIntensity: maxSkinIntensity,
      symptomScore: maxSymptomScore,
    });
  }
  
  return dailyBurdens.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate 14-day rolling baseline for a given day index
 * Returns the average dailySeverity over the previous 14 days (excluding current day)
 */
function calculate14DayBaseline(dailyBurdens: DailyBurden[], currentIndex: number): number | null {
  if (currentIndex < 1) return null;
  
  const currentDate = new Date(dailyBurdens[currentIndex].date);
  const fourteenDaysAgo = new Date(currentDate);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  
  // Get all days in the 14-day window before current day
  const windowScores: number[] = [];
  for (let i = 0; i < currentIndex; i++) {
    const d = new Date(dailyBurdens[i].date);
    if (d >= fourteenDaysAgo && d < currentDate) {
      windowScores.push(dailyBurdens[i].score);
    }
  }
  
  if (windowScores.length === 0) return null;
  
  return windowScores.reduce((a, b) => a + b, 0) / windowScores.length;
}

/**
 * Determine baseline confidence level based on check-in count
 */
export function getBaselineConfidence(checkInCount: number): BaselineConfidence {
  if (checkInCount < 7) return 'early';
  if (checkInCount < 14) return 'provisional';
  return 'mature';
}

/**
 * Calculate overall baseline (for display purposes)
 */
export function calculateBaselineBurdenScore(
  dailyBurdens: DailyBurden[],
  confidence: BaselineConfidence
): number | null {
  if (dailyBurdens.length === 0) return null;
  if (confidence === 'early') return null;
  
  // Use average of all scores as the overall baseline
  const sum = dailyBurdens.reduce((a, b) => a + b.score, 0);
  return sum / dailyBurdens.length;
}

/**
 * Calculate flare threshold (baseline + 0.5)
 */
export function calculateFlareThreshold(
  baseline: number | null,
  confidence: BaselineConfidence
): number | null {
  if (baseline === null || confidence === 'early') {
    return null;
  }
  return baseline + 0.5;
}

/**
 * Detect flare episodes
 * A flare starts when dailySeverity >= baseline + 0.5 for ≥3 consecutive days
 */
export function detectFlareEpisodes(
  dailyBurdens: DailyBurden[],
  flareThreshold: number,
  confidence: BaselineConfidence
): FlareEpisode[] {
  if (dailyBurdens.length < 3 || confidence === 'early') {
    return [];
  }
  
  const episodes: FlareEpisode[] = [];
  let consecutiveAbove: number[] = []; // indices of consecutive days above threshold
  
  for (let i = 0; i < dailyBurdens.length; i++) {
    const baseline = calculate14DayBaseline(dailyBurdens, i);
    const threshold = baseline !== null ? baseline + 0.5 : flareThreshold;
    
    const isAboveThreshold = dailyBurdens[i].score >= threshold;
    
    if (isAboveThreshold) {
      consecutiveAbove.push(i);
    } else {
      // Check if we had a valid flare (≥3 consecutive days)
      if (consecutiveAbove.length >= 3) {
        const startIdx = consecutiveAbove[0];
        const endIdx = consecutiveAbove[consecutiveAbove.length - 1];
        
        // Find peak day
        let peakIdx = startIdx;
        let peakScore = dailyBurdens[startIdx].score;
        for (const idx of consecutiveAbove) {
          if (dailyBurdens[idx].score > peakScore) {
            peakScore = dailyBurdens[idx].score;
            peakIdx = idx;
          }
        }
        
        episodes.push({
          startDate: dailyBurdens[startIdx].date,
          endDate: dailyBurdens[endIdx].date,
          peakDate: dailyBurdens[peakIdx].date,
          durationDays: consecutiveAbove.length,
          peakBurdenScore: peakScore,
          isActive: false,
          isPaused: false,
        });
      }
      consecutiveAbove = [];
    }
  }
  
  // Handle ongoing flare at end of data
  if (consecutiveAbove.length >= 3) {
    const startIdx = consecutiveAbove[0];
    const endIdx = consecutiveAbove[consecutiveAbove.length - 1];
    
    let peakIdx = startIdx;
    let peakScore = dailyBurdens[startIdx].score;
    for (const idx of consecutiveAbove) {
      if (dailyBurdens[idx].score > peakScore) {
        peakScore = dailyBurdens[idx].score;
        peakIdx = idx;
      }
    }
    
    episodes.push({
      startDate: dailyBurdens[startIdx].date,
      endDate: null, // Still active
      peakDate: dailyBurdens[peakIdx].date,
      durationDays: consecutiveAbove.length,
      peakBurdenScore: peakScore,
      isActive: true,
      isPaused: false,
    });
  }
  
  return episodes;
}

/**
 * Assign flare state to each logged day
 */
export function assignDailyFlareStates(
  dailyBurdens: DailyBurden[],
  baselineBurdenScore: number | null,
  flareThreshold: number | null,
  flareEpisodes: FlareEpisode[],
  confidence: BaselineConfidence
): DailyFlareState[] {
  const states: DailyFlareState[] = [];
  
  // Build set of dates in flare episodes and their peak dates
  const flareDates = new Set<string>();
  const peakDates = new Set<string>();
  
  for (const episode of flareEpisodes) {
    peakDates.add(episode.peakDate);
    
    // Add all dates in episode
    const startDate = new Date(episode.startDate);
    const endDate = episode.endDate ? new Date(episode.endDate) : new Date();
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      flareDates.add(dateStr);
    }
  }
  
  for (let i = 0; i < dailyBurdens.length; i++) {
    const burden = dailyBurdens[i];
    const baseline = calculate14DayBaseline(dailyBurdens, i);
    
    let flareState: FlareState = 'stable';
    const isInFlare = flareDates.has(burden.date);
    
    if (confidence === 'early') {
      // Not enough data - everything is stable
      flareState = 'stable';
    } else if (isInFlare) {
      if (peakDates.has(burden.date)) {
        flareState = 'peak_flare';
      } else {
        flareState = 'active_flare';
      }
    } else if (baseline !== null) {
      const threshold = baseline + 0.5;
      
      // Check for pre_flare: severity rising but not yet 3 days
      if (i >= 1 && burden.score >= threshold) {
        const prev = dailyBurdens[i - 1];
        if (burden.score > prev.score) {
          flareState = 'pre_flare';
        }
      }
      
      // Check for resolving_flare: recently ended flare and severity dropping
      const recentEndedEpisode = flareEpisodes.find(ep => {
        if (!ep.endDate) return false;
        const endDate = new Date(ep.endDate);
        const burdenDate = new Date(burden.date);
        const daysSinceEnd = Math.floor((burdenDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceEnd > 0 && daysSinceEnd <= 3;
      });
      
      if (recentEndedEpisode && i >= 1) {
        const prev = dailyBurdens[i - 1];
        if (burden.score < prev.score) {
          flareState = 'resolving_flare';
        }
      }
    }
    
    states.push({
      date: burden.date,
      burdenScore: burden.score,
      rollingAverage3: baseline, // Using 14-day baseline instead
      flareState,
      isInFlareEpisode: isInFlare,
    });
  }
  
  return states;
}

/**
 * Main analysis function
 */
export function analyzeFlareState(checkIns: CheckInData[]): FlareAnalysis {
  if (checkIns.length === 0) {
    return {
      dailyBurdens: [],
      baselineBurdenScore: null,
      baselineConfidence: 'early',
      flareThreshold: null,
      flareEpisodes: [],
      dailyFlareStates: [],
      currentState: 'stable',
      isInActiveFlare: false,
      currentFlareDuration: null,
    };
  }
  
  const dailyBurdens = calculateDailyBurdens(checkIns);
  const confidence = getBaselineConfidence(checkIns.length);
  const baselineBurdenScore = calculateBaselineBurdenScore(dailyBurdens, confidence);
  const flareThreshold = calculateFlareThreshold(baselineBurdenScore, confidence);
  
  const flareEpisodes = flareThreshold !== null 
    ? detectFlareEpisodes(dailyBurdens, flareThreshold, confidence)
    : [];
  
  const dailyFlareStates = assignDailyFlareStates(
    dailyBurdens,
    baselineBurdenScore,
    flareThreshold,
    flareEpisodes,
    confidence
  );
  
  // Determine current state from most recent day
  const currentState = dailyFlareStates.length > 0
    ? dailyFlareStates[dailyFlareStates.length - 1].flareState
    : 'stable';
  
  // Check if currently in an active flare
  const activeFlare = flareEpisodes.find(ep => ep.isActive);
  const isInActiveFlare = activeFlare !== null && activeFlare !== undefined;
  const currentFlareDuration = activeFlare?.durationDays ?? null;
  
  return {
    dailyBurdens,
    baselineBurdenScore,
    baselineConfidence: confidence,
    flareThreshold,
    flareEpisodes,
    dailyFlareStates,
    currentState,
    isInActiveFlare,
    currentFlareDuration,
  };
}

// Keep exports for compatibility with existing code
export function calculateDailyBurdenScore(checkIn: CheckInData): number {
  return calculateDailySeverity(checkIn);
}

export function calculateRollingAverage3(
  dailyBurdens: DailyBurden[],
  currentIndex: number
): number | null {
  return calculate14DayBaseline(dailyBurdens, currentIndex);
}
