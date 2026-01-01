/**
 * Flare State Engine (Skin-Severity Only)
 * 
 * States: Stable, Stable-Severe, Active Flare, Recovering
 * 
 * Key principles:
 * - Flare state is determined ONLY by skin severity over time
 * - Pain, symptoms, sleep, mood are for contextual insights only
 * - Skin severity: GREEN (good) → YELLOW → ORANGE → RED (worst)
 */

export type FlareState = 
  | 'stable' 
  | 'stable_severe'  // RED skin, no change for ≥5-7 days
  | 'early_flare'    // worsening trend starting (2 days)
  | 'active_flare'   // RED + worsening sustained ≥3 days
  | 'recovering';    // improving from RED to ORANGE or better, sustained ≥3 days

export type BaselineConfidence = 'early' | 'provisional' | 'mature';

/**
 * Skin severity levels (derived from skinFeeling 1-5)
 * skinFeeling: 1 = worst, 5 = best
 * We convert to severity: 0 = GREEN (best), 1 = YELLOW, 2 = ORANGE, 3 = RED (worst)
 */
export type SkinSeverityLevel = 'green' | 'yellow' | 'orange' | 'red';

export function getSkinSeverityFromFeeling(skinFeeling: number): number {
  // skinFeeling: 1 = worst (RED), 5 = best (GREEN)
  // severity: 0 = GREEN, 1 = YELLOW, 2 = ORANGE, 3 = RED
  if (skinFeeling >= 4) return 0; // GREEN (4-5)
  if (skinFeeling === 3) return 1; // YELLOW
  if (skinFeeling === 2) return 2; // ORANGE
  return 3; // RED (skinFeeling = 1)
}

export function getSkinSeverityLabel(severity: number): SkinSeverityLevel {
  if (severity === 0) return 'green';
  if (severity === 1) return 'yellow';
  if (severity === 2) return 'orange';
  return 'red';
}

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
  isPaused: boolean;
}

export interface DailyFlareState {
  date: string;
  burdenScore: number;
  rollingAverage3: number | null;
  flareState: FlareState;
  isInFlareEpisode: boolean;
  explanation?: string;
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
  pain_score?: number;
  sleep_score?: number;
  mood?: number;
}

interface DailySkinMetrics {
  date: string;
  skinSeverity: number;      // 0 = GREEN, 1 = YELLOW, 2 = ORANGE, 3 = RED
  skinFeeling: number;       // original 1-5 value (for context)
  checkInCount: number;
  // Contextual data (not used for flare detection)
  avgSymptomSeverity: number;
  painScore: number;
  mood: number;
}

/**
 * Calculate skin metrics for a single day from check-ins
 * Uses WORST skin reading of the day
 */
function calculateDailySkinMetrics(dayCheckIns: CheckInData[]): DailySkinMetrics {
  let worstSkinFeeling = 5; // Start with best
  let totalSymptomSeverity = 0;
  let symptomCount = 0;
  let maxPain = 0;
  let moodSum = 0;
  let moodCount = 0;
  
  for (const checkIn of dayCheckIns) {
    // Get worst skin feeling of the day
    worstSkinFeeling = Math.min(worstSkinFeeling, checkIn.skinFeeling);
    
    // Contextual: pain
    const pain = checkIn.pain_score ?? 0;
    maxPain = Math.max(maxPain, pain);
    
    // Contextual: mood
    if (checkIn.mood !== undefined && checkIn.mood !== null) {
      moodSum += checkIn.mood;
      moodCount++;
    }
    
    // Contextual: symptoms
    const symptoms = checkIn.symptomsExperienced ?? [];
    for (const symptom of symptoms) {
      totalSymptomSeverity += symptom.severity;
      symptomCount++;
    }
  }
  
  return {
    date: dayCheckIns[0].created_at.split('T')[0],
    skinSeverity: getSkinSeverityFromFeeling(worstSkinFeeling),
    skinFeeling: worstSkinFeeling,
    checkInCount: dayCheckIns.length,
    // Contextual data
    avgSymptomSeverity: symptomCount > 0 ? totalSymptomSeverity / symptomCount : 0,
    painScore: maxPain,
    mood: moodCount > 0 ? moodSum / moodCount : 3,
  };
}

/**
 * Group check-ins by date and calculate daily skin metrics
 */
function calculateAllDailySkinMetrics(checkIns: CheckInData[]): DailySkinMetrics[] {
  const byDate = new Map<string, CheckInData[]>();
  
  for (const checkIn of checkIns) {
    const date = checkIn.created_at.split('T')[0];
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(checkIn);
  }
  
  const metrics: DailySkinMetrics[] = [];
  for (const [, dayCheckIns] of byDate) {
    metrics.push(calculateDailySkinMetrics(dayCheckIns));
  }
  
  return metrics.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Count consecutive days where skin is worsening (severity increasing)
 */
function getConsecutiveSkinWorseningDays(metrics: DailySkinMetrics[]): number {
  if (metrics.length < 2) return 0;
  
  let count = 0;
  for (let i = metrics.length - 1; i > 0; i--) {
    const today = metrics[i].skinSeverity;
    const yesterday = metrics[i - 1].skinSeverity;
    
    if (today > yesterday) {
      count++;
    } else {
      break;
    }
  }
  
  return count;
}

/**
 * Count consecutive days where skin is improving (severity decreasing)
 */
function getConsecutiveSkinImprovingDays(metrics: DailySkinMetrics[]): number {
  if (metrics.length < 2) return 0;
  
  let count = 0;
  for (let i = metrics.length - 1; i > 0; i--) {
    const today = metrics[i].skinSeverity;
    const yesterday = metrics[i - 1].skinSeverity;
    
    if (today < yesterday) {
      count++;
    } else {
      break;
    }
  }
  
  return count;
}

/**
 * Count consecutive days with stable skin (no change in severity)
 */
function getConsecutiveSkinStableDays(metrics: DailySkinMetrics[]): number {
  if (metrics.length < 2) return 0;
  
  let count = 1; // Current day counts
  for (let i = metrics.length - 1; i > 0; i--) {
    const today = metrics[i].skinSeverity;
    const yesterday = metrics[i - 1].skinSeverity;
    
    if (today === yesterday) {
      count++;
    } else {
      break;
    }
  }
  
  return count;
}

/**
 * Check if skin is currently RED (severity = 3)
 */
function isCurrentSkinRed(metrics: DailySkinMetrics[]): boolean {
  if (metrics.length === 0) return false;
  return metrics[metrics.length - 1].skinSeverity === 3;
}

/**
 * Check if skin was RED recently (within last N days)
 */
function wasSkinRedRecently(metrics: DailySkinMetrics[], lookbackDays: number = 5): boolean {
  const recent = metrics.slice(-lookbackDays);
  return recent.some(m => m.skinSeverity === 3);
}

/**
 * ACTIVE FLARE: skin worsens to RED and worsening sustained ≥3 days
 */
function shouldBeActiveFlare(metrics: DailySkinMetrics[]): boolean {
  if (metrics.length < 3) return false;
  
  // Must currently be RED
  if (!isCurrentSkinRed(metrics)) return false;
  
  // Check for sustained worsening (≥3 consecutive days of worsening)
  const worseningDays = getConsecutiveSkinWorseningDays(metrics);
  if (worseningDays >= 3) return true;
  
  // Also consider: if at RED and came from lower severity in last few days
  const last3Days = metrics.slice(-3);
  if (last3Days.length >= 3) {
    const hadLowerSeverity = last3Days.slice(0, -1).some(m => m.skinSeverity < 3);
    const currentlyRed = last3Days[last3Days.length - 1].skinSeverity === 3;
    const stillWorsening = last3Days[last3Days.length - 1].skinSeverity >= last3Days[0].skinSeverity;
    
    if (hadLowerSeverity && currentlyRed && stillWorsening && worseningDays >= 2) {
      return true;
    }
  }
  
  return false;
}

/**
 * STABLE-SEVERE: skin remains RED with no improvement or worsening for ≥5-7 days
 */
function shouldBeStableSevere(metrics: DailySkinMetrics[]): boolean {
  if (metrics.length < 5) return false;
  
  // Must currently be RED
  if (!isCurrentSkinRed(metrics)) return false;
  
  // Check if actively worsening - if so, it's active flare, not stable-severe
  const worseningDays = getConsecutiveSkinWorseningDays(metrics);
  if (worseningDays >= 2) return false;
  
  // Check if actively improving - if so, it's recovering
  const improvingDays = getConsecutiveSkinImprovingDays(metrics);
  if (improvingDays >= 2) return false;
  
  // Count how many of last 5-7 days have been RED
  const lookbackDays = Math.min(7, metrics.length);
  const recentMetrics = metrics.slice(-lookbackDays);
  const redDays = recentMetrics.filter(m => m.skinSeverity === 3).length;
  
  // At least 5 out of 7 days (or 5 out of available days) should be RED
  return redDays >= 5;
}

/**
 * RECOVERING: skin improves from RED to ORANGE or better, sustained ≥3 days
 */
function shouldBeRecovering(metrics: DailySkinMetrics[]): boolean {
  if (metrics.length < 3) return false;
  
  // Current skin should NOT be RED (must have improved)
  const currentSeverity = metrics[metrics.length - 1].skinSeverity;
  if (currentSeverity === 3) return false; // Still RED, not recovering
  
  // Must have been RED recently (within last 5 days)
  if (!wasSkinRedRecently(metrics, 5)) return false;
  
  // Check for sustained improvement (≥3 consecutive days of improving OR stable-at-lower-level)
  const improvingDays = getConsecutiveSkinImprovingDays(metrics);
  if (improvingDays >= 2) return true;
  
  // Or: was RED, now ORANGE or better for at least 2 days
  const last3Days = metrics.slice(-3);
  const hadRed = metrics.slice(-5, -2).some(m => m.skinSeverity === 3);
  const nowBetter = last3Days.every(m => m.skinSeverity < 3);
  
  if (hadRed && nowBetter) return true;
  
  return false;
}

/**
 * STABLE: skin is GREEN or YELLOW with no recent worsening
 */
function shouldBeStable(metrics: DailySkinMetrics[]): boolean {
  if (metrics.length === 0) return true;
  
  const currentSeverity = metrics[metrics.length - 1].skinSeverity;
  
  // GREEN (0) or YELLOW (1) = potentially stable
  if (currentSeverity > 1) return false; // ORANGE or RED
  
  // Check for recent worsening trend
  const worseningDays = getConsecutiveSkinWorseningDays(metrics);
  if (worseningDays >= 2) return false;
  
  return true;
}

/**
 * EARLY FLARE: skin starting to worsen (2 days of worsening, not yet 3)
 */
function shouldBeEarlyFlare(metrics: DailySkinMetrics[]): boolean {
  if (metrics.length < 2) return false;
  
  const worseningDays = getConsecutiveSkinWorseningDays(metrics);
  
  // Exactly 2 days of worsening (not yet 3)
  return worseningDays === 2;
}

/**
 * Determine baseline confidence based on data amount
 */
export function getBaselineConfidence(checkInCount: number): BaselineConfidence {
  if (checkInCount < 7) return 'early';
  if (checkInCount < 14) return 'provisional';
  return 'mature';
}

/**
 * Main flare analysis function - uses ONLY skin severity
 */
export function analyzeFlareState(checkIns: CheckInData[]): FlareAnalysis {
  if (checkIns.length === 0) {
    return createEmptyAnalysis();
  }
  
  const allMetrics = calculateAllDailySkinMetrics(checkIns);
  const confidence = getBaselineConfidence(checkIns.length);
  
  // Build daily flare states
  const dailyFlareStates: DailyFlareState[] = [];
  const flareEpisodes: FlareEpisode[] = [];
  
  // Track flare episode
  let currentFlareStartIdx: number | null = null;
  
  for (let i = 0; i < allMetrics.length; i++) {
    const metricsUpToNow = allMetrics.slice(0, i + 1);
    const metrics = allMetrics[i];
    
    let flareState: FlareState = 'stable';
    let isInFlareEpisode = false;
    let explanation: string | undefined;
    
    // Calculate burden score for compatibility (skin-based)
    const burdenScore = metrics.skinSeverity;
    
    if (confidence === 'early') {
      flareState = 'stable';
      explanation = 'Building baseline — need more data.';
    } else {
      // Determine state based on skin severity only
      // Priority order matters!
      
      // Priority 1: RECOVERING (if improving from RED)
      if (shouldBeRecovering(metricsUpToNow)) {
        flareState = 'recovering';
        isInFlareEpisode = false;
        if (currentFlareStartIdx !== null) {
          flareEpisodes.push({
            startDate: allMetrics[currentFlareStartIdx].date,
            endDate: allMetrics[i > 0 ? i - 1 : i].date,
            peakDate: allMetrics[currentFlareStartIdx].date,
            durationDays: i - currentFlareStartIdx,
            peakBurdenScore: 3,
            isActive: false,
            isPaused: false,
          });
          currentFlareStartIdx = null;
        }
        explanation = 'Recovering — skin improving from RED.';
      }
      // Priority 2: STABLE (GREEN or YELLOW, no worsening)
      else if (shouldBeStable(metricsUpToNow)) {
        flareState = 'stable';
        isInFlareEpisode = false;
        if (currentFlareStartIdx !== null) {
          flareEpisodes.push({
            startDate: allMetrics[currentFlareStartIdx].date,
            endDate: allMetrics[i > 0 ? i - 1 : i].date,
            peakDate: allMetrics[currentFlareStartIdx].date,
            durationDays: i - currentFlareStartIdx,
            peakBurdenScore: 3,
            isActive: false,
            isPaused: false,
          });
          currentFlareStartIdx = null;
        }
        explanation = 'Stable — skin is GREEN or YELLOW.';
      }
      // Priority 3: STABLE-SEVERE (RED but not changing for 5+ days)
      else if (shouldBeStableSevere(metricsUpToNow)) {
        flareState = 'stable_severe';
        isInFlareEpisode = false;
        if (currentFlareStartIdx !== null) {
          flareEpisodes.push({
            startDate: allMetrics[currentFlareStartIdx].date,
            endDate: allMetrics[i > 0 ? i - 1 : i].date,
            peakDate: allMetrics[currentFlareStartIdx].date,
            durationDays: i - currentFlareStartIdx,
            peakBurdenScore: 3,
            isActive: false,
            isPaused: false,
          });
          currentFlareStartIdx = null;
        }
        explanation = 'Stable – Severe — skin has been RED but consistent for 5+ days.';
      }
      // Priority 4: ACTIVE FLARE (RED + worsening ≥3 days)
      else if (shouldBeActiveFlare(metricsUpToNow)) {
        flareState = 'active_flare';
        isInFlareEpisode = true;
        if (currentFlareStartIdx === null) {
          currentFlareStartIdx = Math.max(0, i - 2);
        }
        explanation = 'Active Flare — skin has worsened to RED.';
      }
      // Priority 5: EARLY FLARE (worsening 2 days)
      else if (shouldBeEarlyFlare(metricsUpToNow)) {
        flareState = 'early_flare';
        isInFlareEpisode = true;
        if (currentFlareStartIdx === null) {
          currentFlareStartIdx = Math.max(0, i - 1);
        }
        explanation = 'Early Flare — skin starting to worsen.';
      }
      // Default: based on current skin level
      else {
        const currentSeverity = metrics.skinSeverity;
        if (currentSeverity <= 1) {
          flareState = 'stable';
          explanation = 'Stable — skin is in good condition.';
        } else if (currentSeverity === 2) {
          flareState = 'stable';
          explanation = 'Stable — skin is ORANGE, monitoring.';
        } else {
          // RED but doesn't meet other criteria yet
          flareState = 'early_flare';
          explanation = 'Monitoring — skin is RED.';
        }
      }
    }
    
    dailyFlareStates.push({
      date: metrics.date,
      burdenScore,
      rollingAverage3: null,
      flareState,
      isInFlareEpisode,
      explanation,
    });
  }
  
  // Handle ongoing flare at end of data
  if (currentFlareStartIdx !== null) {
    flareEpisodes.push({
      startDate: allMetrics[currentFlareStartIdx].date,
      endDate: null,
      peakDate: allMetrics[currentFlareStartIdx].date,
      durationDays: allMetrics.length - currentFlareStartIdx,
      peakBurdenScore: 3,
      isActive: true,
      isPaused: false,
    });
  }
  
  // Determine current state from most recent day
  const currentState = dailyFlareStates.length > 0
    ? dailyFlareStates[dailyFlareStates.length - 1].flareState
    : 'stable';
  
  const activeFlare = flareEpisodes.find(ep => ep.isActive);
  
  // Convert to legacy DailyBurden format
  const dailyBurdens: DailyBurden[] = allMetrics.map(m => ({
    date: m.date,
    score: m.skinSeverity,
    skinIntensity: m.skinSeverity,
    symptomScore: m.avgSymptomSeverity * 3,
  }));
  
  // Calculate baseline for display
  const baselineBurdenScore = dailyBurdens.length >= 7
    ? dailyBurdens.slice(-7).reduce((s, b) => s + b.score, 0) / Math.min(7, dailyBurdens.length)
    : null;
  
  return {
    dailyBurdens,
    baselineBurdenScore,
    baselineConfidence: confidence,
    flareThreshold: baselineBurdenScore !== null ? baselineBurdenScore + 0.5 : null,
    flareEpisodes,
    dailyFlareStates,
    currentState,
    isInActiveFlare: currentState === 'active_flare',
    currentFlareDuration: activeFlare?.durationDays ?? null,
  };
}

function createEmptyAnalysis(): FlareAnalysis {
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

// Legacy exports for compatibility
export function calculateDailyBurdens(checkIns: CheckInData[]): DailyBurden[] {
  const metrics = calculateAllDailySkinMetrics(checkIns);
  return metrics.map(m => ({
    date: m.date,
    score: m.skinSeverity,
    skinIntensity: m.skinSeverity,
    symptomScore: m.avgSymptomSeverity * 3,
  }));
}

export function calculateDailyBurdenScore(checkIn: CheckInData): number {
  return getSkinSeverityFromFeeling(checkIn.skinFeeling);
}

export function calculateRollingAverage3(
  dailyBurdens: DailyBurden[],
  currentIndex: number
): number | null {
  if (currentIndex < 3) return null;
  const window = dailyBurdens.slice(currentIndex - 3, currentIndex);
  return window.reduce((s, b) => s + b.score, 0) / window.length;
}

export function calculateBaselineBurdenScore(
  dailyBurdens: DailyBurden[],
  confidence: BaselineConfidence
): number | null {
  if (dailyBurdens.length === 0 || confidence === 'early') return null;
  return dailyBurdens.reduce((s, b) => s + b.score, 0) / dailyBurdens.length;
}

export function calculateFlareThreshold(
  baseline: number | null,
  confidence: BaselineConfidence
): number | null {
  if (baseline === null || confidence === 'early') return null;
  return baseline + 0.5;
}

export function detectFlareEpisodes(
  dailyBurdens: DailyBurden[],
  flareThreshold: number,
  confidence: BaselineConfidence
): FlareEpisode[] {
  return [];
}

export function assignDailyFlareStates(
  dailyBurdens: DailyBurden[],
  baselineBurdenScore: number | null,
  flareThreshold: number | null,
  flareEpisodes: FlareEpisode[],
  confidence: BaselineConfidence
): DailyFlareState[] {
  return dailyBurdens.map(b => ({
    date: b.date,
    burdenScore: b.score,
    rollingAverage3: null,
    flareState: 'stable' as FlareState,
    isInFlareEpisode: false,
  }));
}
