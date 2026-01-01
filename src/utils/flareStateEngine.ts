/**
 * Flare State Engine (Progressive Edition)
 * 
 * System-derived flare detection that works from day 1, improves with more data,
 * handles missed days safely, and classifies skin state without alarming users.
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

// Absolute thresholds for flare detection when relative detection fails
// (e.g., when user starts tracking during a flare)
const ABSOLUTE_SKIN_INTENSITY_FLARE = 3; // skinIntensity >= 3 is flare territory
const ABSOLUTE_BURDEN_FLARE = 6; // burden score >= 6 is significant regardless of baseline
const HIGH_BASELINE_THRESHOLD = 5; // if baseline itself is >= 5, user likely started during flare

export type FlareState = 
  | 'stable' 
  | 'pre_flare' 
  | 'active_flare' 
  | 'peak_flare' 
  | 'resolving_flare';

export type BaselineConfidence = 'early' | 'provisional' | 'mature';

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
  durationDays: number; // Count of logged days only
  peakBurdenScore: number;
  isActive: boolean;
  isPaused: boolean; // Paused due to missed days
}

export interface DailyFlareState {
  date: string;
  burdenScore: number;
  rollingAverage3: number | null;
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
 * Calculate daily flare burden score from a check-in
 */
export function calculateDailyBurdenScore(checkIn: CheckInData): number {
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
  
  return skinIntensity + symptomScore;
}

/**
 * Group check-ins by date and calculate daily burden scores
 * Missing days are NOT created - they remain null
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
  
  return dailyBurdens.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Determine baseline confidence level based on check-in count
 */
export function getBaselineConfidence(checkInCount: number): BaselineConfidence {
  if (checkInCount < 7) return 'early';
  if (checkInCount < 20) return 'provisional';
  return 'mature';
}

/**
 * Calculate progressive personal baseline based on available data
 */
export function calculateBaselineBurdenScore(
  dailyBurdens: DailyBurden[],
  confidence: BaselineConfidence
): number | null {
  if (confidence === 'early') {
    // Not enough data for baseline
    return null;
  }
  
  if (confidence === 'provisional') {
    // Use median of ALL available scores
    return calculateMedian(dailyBurdens.map(b => b.score));
  }
  
  // Mature: median of lowest 25% from last 30-45 days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 45);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];
  
  let recentBurdens = dailyBurdens.filter(b => b.date >= cutoffStr);
  
  // Fall back to all data if not enough recent data
  if (recentBurdens.length < 7) {
    recentBurdens = dailyBurdens;
  }
  
  const scores = recentBurdens.map(b => b.score).sort((a, b) => a - b);
  const lowest25PercentCount = Math.max(1, Math.floor(scores.length * 0.25));
  const lowest25Percent = scores.slice(0, lowest25PercentCount);
  
  return calculateMedian(lowest25Percent);
}

function calculateMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Calculate flare threshold based on baseline confidence
 */
export function calculateFlareThreshold(
  baseline: number | null,
  confidence: BaselineConfidence
): number | null {
  if (baseline === null || confidence === 'early') {
    return null;
  }
  
  // Provisional: stricter threshold (1.8x)
  // Mature: standard threshold (1.5x)
  const multiplier = confidence === 'provisional' ? 1.8 : 1.5;
  return baseline * multiplier;
}

/**
 * Gap-tolerant rolling average: uses last 3 AVAILABLE check-ins, not calendar days
 */
export function calculateRollingAverage3(
  dailyBurdens: DailyBurden[],
  currentIndex: number
): number | null {
  if (currentIndex < 2) return null;
  
  // Get the 3 most recent scores including current
  const scores = [
    dailyBurdens[currentIndex].score,
    dailyBurdens[currentIndex - 1].score,
    dailyBurdens[currentIndex - 2].score,
  ];
  
  return scores.reduce((a, b) => a + b, 0) / 3;
}

/**
 * Check if there are missed days between two dates
 */
function getMissedDaysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays - 1); // Subtract 1 because consecutive days have 0 missed
}

/**
 * Detect flare episodes with gap tolerance and phase-specific rules
 */
export function detectFlareEpisodes(
  dailyBurdens: DailyBurden[],
  flareThreshold: number,
  confidence: BaselineConfidence
): FlareEpisode[] {
  if (dailyBurdens.length < 3 || confidence === 'early') {
    return [];
  }
  
  // Provisional requires 3 consecutive, mature requires 2
  const requiredConsecutive = confidence === 'provisional' ? 3 : 2;
  
  const episodes: FlareEpisode[] = [];
  let currentEpisode: {
    startIndex: number;
    peakIndex: number;
    peakScore: number;
    consecutiveAbove: number;
    loggedDays: number;
    isPaused: boolean;
  } | null = null;
  let consecutiveBelow = 0;
  
  for (let i = 2; i < dailyBurdens.length; i++) {
    const rollingAvg = calculateRollingAverage3(dailyBurdens, i);
    if (rollingAvg === null) continue;
    
    // Check for missed days (gap tolerance)
    const missedDays = getMissedDaysBetween(dailyBurdens[i - 1].date, dailyBurdens[i].date);
    
    const isAboveThreshold = rollingAvg > flareThreshold;
    
    if (currentEpisode !== null && missedDays >= 2) {
      // Pause episode due to too many missed days
      currentEpisode.isPaused = true;
    }
    
    if (isAboveThreshold) {
      consecutiveBelow = 0;
      
      if (currentEpisode === null) {
        currentEpisode = {
          startIndex: i,
          peakIndex: i,
          peakScore: dailyBurdens[i].score,
          consecutiveAbove: 1,
          loggedDays: 1,
          isPaused: false,
        };
      } else if (!currentEpisode.isPaused) {
        currentEpisode.consecutiveAbove++;
        currentEpisode.loggedDays++;
        if (dailyBurdens[i].score > currentEpisode.peakScore) {
          currentEpisode.peakScore = dailyBurdens[i].score;
          currentEpisode.peakIndex = i;
        }
      } else if (currentEpisode.isPaused && missedDays <= 1) {
        // Resume paused episode if gap is acceptable
        currentEpisode.isPaused = false;
        currentEpisode.loggedDays++;
        if (dailyBurdens[i].score > currentEpisode.peakScore) {
          currentEpisode.peakScore = dailyBurdens[i].score;
          currentEpisode.peakIndex = i;
        }
      }
    } else {
      if (currentEpisode !== null && !currentEpisode.isPaused) {
        consecutiveBelow++;
        
        if (consecutiveBelow >= 2) {
          // Only count as flare if it met the required consecutive threshold
          if (currentEpisode.consecutiveAbove >= requiredConsecutive) {
            const endIndex = i - consecutiveBelow;
            episodes.push({
              startDate: dailyBurdens[currentEpisode.startIndex].date,
              endDate: dailyBurdens[endIndex].date,
              peakDate: dailyBurdens[currentEpisode.peakIndex].date,
              durationDays: currentEpisode.loggedDays,
              peakBurdenScore: currentEpisode.peakScore,
              isActive: false,
              isPaused: false,
            });
          }
          currentEpisode = null;
          consecutiveBelow = 0;
        }
      }
    }
  }
  
  // Handle ongoing flare at end of data
  if (currentEpisode !== null && currentEpisode.consecutiveAbove >= requiredConsecutive) {
    episodes.push({
      startDate: dailyBurdens[currentEpisode.startIndex].date,
      endDate: null,
      peakDate: dailyBurdens[currentEpisode.peakIndex].date,
      durationDays: currentEpisode.loggedDays,
      peakBurdenScore: currentEpisode.peakScore,
      isActive: !currentEpisode.isPaused,
      isPaused: currentEpisode.isPaused,
    });
  }
  
  return episodes;
}

/**
 * Assign flare state to each logged day (missing days get no state)
 */
export function assignDailyFlareStates(
  dailyBurdens: DailyBurden[],
  baselineBurdenScore: number | null,
  flareThreshold: number | null,
  flareEpisodes: FlareEpisode[],
  confidence: BaselineConfidence
): DailyFlareState[] {
  const states: DailyFlareState[] = [];
  
  // Build a map of dates to their episode
  const dateToEpisode = new Map<string, FlareEpisode>();
  for (const episode of flareEpisodes) {
    const startDate = new Date(episode.startDate);
    const endDate = episode.endDate ? new Date(episode.endDate) : new Date();
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      dateToEpisode.set(dateStr, episode);
    }
  }
  
  // Get peak thresholds for top 20% calculation per episode
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
    const rollingAvg = calculateRollingAverage3(dailyBurdens, i);
    const episode = dateToEpisode.get(burden.date);
    
    let flareState: FlareState = 'stable';
    
    // Early phase: only stable (no flare detection)
    if (confidence === 'early') {
      states.push({
        date: burden.date,
        burdenScore: burden.score,
        rollingAverage3: rollingAvg,
        flareState: 'stable',
        isInFlareEpisode: false,
      });
      continue;
    }
    
    if (episode && !episode.isPaused) {
      // Only assign flare states if this day actually has flare-level symptoms
      // Don't blindly assign based on episode date range - a good day is stable
      if (isDefinitelyGoodDay(burden)) {
        flareState = 'stable';
      } else if (flareThreshold !== null && burden.score >= flareThreshold) {
        const peakThreshold = episodePeakThresholds.get(episode) ?? episode.peakBurdenScore;
        if (burden.score >= peakThreshold) {
          flareState = 'peak_flare';
        } else {
          flareState = 'active_flare';
        }
      }
      // Otherwise leave as stable even if within episode date range
    } else if (baselineBurdenScore !== null && flareThreshold !== null) {
      // Check for resolving flare
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
      
      // Check for pre-flare
      if (flareState === 'stable' && i >= 2 && rollingAvg !== null) {
        // Need at least 2 check-ins in last 3 calendar days for pre_flare
        const threeDaysAgo = new Date(burden.date);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const recentCheckIns = dailyBurdens.filter(b => {
          const bDate = new Date(b.date);
          return bDate >= threeDaysAgo && bDate <= new Date(burden.date);
        });
        
        if (recentCheckIns.length >= 2) {
          const isRising = 
            dailyBurdens[i].score > dailyBurdens[i - 1].score &&
            dailyBurdens[i - 1].score > dailyBurdens[i - 2].score;
          
          if (isRising && rollingAvg < flareThreshold && burden.score > baselineBurdenScore) {
            flareState = 'pre_flare';
          }
        }
      }
    }
    
    states.push({
      date: burden.date,
      burdenScore: burden.score,
      rollingAverage3: rollingAvg,
      flareState,
      isInFlareEpisode: !!episode && !episode.isPaused,
    });
  }
  
  return states;
}

/**
 * Check if a day is definitely a "good day" that cannot be in a flare
 * Used to override incorrect flare classifications
 */
function isDefinitelyGoodDay(burden: DailyBurden): boolean {
  // If skin intensity is low (0-1) and symptoms are minimal, it's a good day
  return burden.skinIntensity <= 1 && burden.symptomScore <= 2;
}

/**
 * Check if the current day qualifies as a flare using absolute thresholds
 * Used when relative detection fails (e.g., high baseline)
 */
function checkAbsoluteFlareState(burden: DailyBurden): FlareState {
  // Good day override - cannot be flare if symptoms are minimal
  if (isDefinitelyGoodDay(burden)) {
    return 'stable';
  }
  
  // Peak flare: very high skin intensity with significant symptoms
  if (burden.skinIntensity >= 4 && burden.symptomScore >= 3) {
    return 'peak_flare';
  }
  
  // Active flare: high skin intensity OR high overall burden
  if (burden.skinIntensity >= ABSOLUTE_SKIN_INTENSITY_FLARE || burden.score >= ABSOLUTE_BURDEN_FLARE) {
    return 'active_flare';
  }
  
  return 'stable';
}

/**
 * Determine if baseline is "high" indicating user likely started tracking during a flare
 */
function isHighBaseline(baselineBurdenScore: number | null, dailyBurdens: DailyBurden[]): boolean {
  if (baselineBurdenScore !== null && baselineBurdenScore >= HIGH_BASELINE_THRESHOLD) {
    return true;
  }
  
  // Also check if most days have high skin intensity
  if (dailyBurdens.length >= 5) {
    const highIntensityDays = dailyBurdens.filter(b => b.skinIntensity >= ABSOLUTE_SKIN_INTENSITY_FLARE).length;
    return highIntensityDays / dailyBurdens.length >= 0.7; // 70%+ days are high intensity
  }
  
  return false;
}

/**
 * Main analysis function - computes complete flare analysis from check-ins
 */
export function analyzeFlareState(checkIns: CheckInData[]): FlareAnalysis {
  const dailyBurdens = calculateDailyBurdens(checkIns);
  const confidence = getBaselineConfidence(dailyBurdens.length);
  const baselineBurdenScore = calculateBaselineBurdenScore(dailyBurdens, confidence);
  const flareThreshold = calculateFlareThreshold(baselineBurdenScore, confidence);
  
  // Detect if user started tracking during a flare (high baseline scenario)
  const hasHighBaseline = isHighBaseline(baselineBurdenScore, dailyBurdens);
  
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
  
  // Determine current state with high baseline fallback
  let currentState: FlareState = dailyFlareStates.length > 0
    ? dailyFlareStates[dailyFlareStates.length - 1].flareState
    : 'stable';
  
  // Final safety check: if most recent day is clearly good, force stable
  // This prevents classification errors from episode date ranges
  if (dailyBurdens.length > 0) {
    const mostRecentBurden = dailyBurdens[dailyBurdens.length - 1];
    
    // Good day always wins - cannot be in a flare with minimal symptoms
    if (isDefinitelyGoodDay(mostRecentBurden)) {
      currentState = 'stable';
    } 
    // If relative detection says "stable" but we have a high baseline,
    // use absolute thresholds on the most recent day
    else if (currentState === 'stable' && hasHighBaseline) {
      currentState = checkAbsoluteFlareState(mostRecentBurden);
    }
    // Also check absolute thresholds during early phase when relative detection isn't available
    else if (confidence === 'early') {
      const absoluteState = checkAbsoluteFlareState(mostRecentBurden);
      if (absoluteState !== 'stable') {
        currentState = absoluteState;
      }
    }
  }
  
  const activeFlare = flareEpisodes.find(ep => ep.isActive);
  // Consider it an active flare if either episode detection found one OR absolute thresholds triggered
  const isInActiveFlare = !!activeFlare || (currentState === 'active_flare' || currentState === 'peak_flare');
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
