/**
 * Flare State Engine (Multi-Day Trend-Based System)
 * 
 * Key principles:
 * - Flares CANNOT be triggered by a single day
 * - Requires ≥2 consecutive days of worsening in ≥2 metrics
 * - Peak flare requires ALL strict criteria for ≥3 days
 * - States: stable, unstable, early_flare, active_flare, recovering, peak_flare
 */

export type FlareState = 
  | 'stable' 
  | 'unstable'      // 1-day spike only
  | 'early_flare'   // worsening for 2 days
  | 'active_flare'  // worsening for ≥3 days
  | 'peak_flare'    // all strict criteria met for ≥3 days
  | 'recovering';   // improving after flare

export type BaselineConfidence = 'early' | 'provisional' | 'mature';

// Severity mapping: Mild=1, Moderate=2, Severe=3
const SEVERITY_MAP = { mild: 1, moderate: 2, severe: 3 } as const;

// Pain tiers: 1-2 = tier 1, 3-4 = tier 2, 5-6 = tier 3, 7+ = tier 4
function getPainTier(pain: number): number {
  if (pain <= 2) return 1;
  if (pain <= 4) return 2;
  if (pain <= 6) return 3;
  return 4;
}

// Skin state tiers: 0-1 = green, 2 = yellow, 3-4 = orange, 5 = red
function getSkinTier(skinIntensity: number): number {
  if (skinIntensity <= 1) return 1; // green
  if (skinIntensity === 2) return 2; // yellow
  if (skinIntensity <= 4) return 3; // orange
  return 4; // red
}

// Sleep/Mood tiers (1-5 scale, higher = worse for this calculation)
function getWellnessTier(score: number): number {
  // Score is 1-5 where 5 is best, so invert for "worseness"
  if (score >= 4) return 1; // good
  if (score === 3) return 2; // neutral
  if (score === 2) return 3; // poor
  return 4; // very poor
}

export interface DailyMetrics {
  date: string;
  avgSymptomSeverity: number;     // average of symptom severities (1-3 scale)
  skinTier: number;               // 1-4 (green to red)
  painTier: number;               // 1-4
  sleepTier: number;              // 1-4 (inverted, higher = worse)
  moodTier: number;               // 1-4 (inverted, higher = worse)
  rawPain: number;                // 1-10 scale
  rawSkinIntensity: number;       // 0-5 scale
  severeSymptomCount: number;     // count of symptoms marked severe
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

/**
 * Calculate daily metrics from check-ins for a single day
 */
function calculateDailyMetrics(dayCheckIns: CheckInData[]): DailyMetrics {
  let totalSymptomSeverity = 0;
  let symptomCount = 0;
  let maxSkinIntensity = 0;
  let maxPain = 0;
  let avgSleep = 3; // default neutral
  let avgMood = 3; // default neutral
  let severeSymptomCount = 0;
  
  let sleepSum = 0;
  let sleepCount = 0;
  let moodSum = 0;
  let moodCount = 0;
  
  for (const checkIn of dayCheckIns) {
    // Skin intensity
    const skinIntensity = checkIn.skinIntensity ?? (5 - checkIn.skinFeeling);
    maxSkinIntensity = Math.max(maxSkinIntensity, skinIntensity);
    
    // Pain
    const pain = checkIn.pain_score ?? 0;
    maxPain = Math.max(maxPain, pain);
    
    // Sleep (1-5, higher = better)
    if (checkIn.sleep_score !== undefined && checkIn.sleep_score !== null) {
      sleepSum += checkIn.sleep_score;
      sleepCount++;
    }
    
    // Mood (1-5, higher = better)
    if (checkIn.mood !== undefined && checkIn.mood !== null) {
      moodSum += checkIn.mood;
      moodCount++;
    }
    
    // Symptoms
    const symptoms = checkIn.symptomsExperienced ?? [];
    for (const symptom of symptoms) {
      // severity: 1=mild, 2=moderate, 3=severe
      totalSymptomSeverity += symptom.severity;
      symptomCount++;
      if (symptom.severity === 3) {
        severeSymptomCount++;
      }
    }
  }
  
  const avgSymptomSeverity = symptomCount > 0 ? totalSymptomSeverity / symptomCount : 0;
  avgSleep = sleepCount > 0 ? sleepSum / sleepCount : 3;
  avgMood = moodCount > 0 ? moodSum / moodCount : 3;
  
  return {
    date: dayCheckIns[0].created_at.split('T')[0],
    avgSymptomSeverity,
    skinTier: getSkinTier(maxSkinIntensity),
    painTier: getPainTier(maxPain),
    sleepTier: getWellnessTier(avgSleep),
    moodTier: getWellnessTier(avgMood),
    rawPain: maxPain,
    rawSkinIntensity: maxSkinIntensity,
    severeSymptomCount,
  };
}

/**
 * Calculate 7-day baseline for each metric
 */
interface BaselineMetrics {
  avgSymptomSeverity: number;
  skinTier: number;
  painTier: number;
  sleepTier: number;
  moodTier: number;
}

function calculate7DayBaseline(
  allMetrics: DailyMetrics[],
  currentIndex: number
): BaselineMetrics | null {
  if (currentIndex < 1) return null;
  
  const currentDate = new Date(allMetrics[currentIndex].date);
  const sevenDaysAgo = new Date(currentDate);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const windowMetrics: DailyMetrics[] = [];
  for (let i = 0; i < currentIndex; i++) {
    const d = new Date(allMetrics[i].date);
    if (d >= sevenDaysAgo && d < currentDate) {
      windowMetrics.push(allMetrics[i]);
    }
  }
  
  if (windowMetrics.length === 0) return null;
  
  const n = windowMetrics.length;
  return {
    avgSymptomSeverity: windowMetrics.reduce((s, m) => s + m.avgSymptomSeverity, 0) / n,
    skinTier: windowMetrics.reduce((s, m) => s + m.skinTier, 0) / n,
    painTier: windowMetrics.reduce((s, m) => s + m.painTier, 0) / n,
    sleepTier: windowMetrics.reduce((s, m) => s + m.sleepTier, 0) / n,
    moodTier: windowMetrics.reduce((s, m) => s + m.moodTier, 0) / n,
  };
}

/**
 * Count how many metrics worsened compared to baseline
 * Returns count of worsening metrics (0-5)
 */
function countWorseningMetrics(
  current: DailyMetrics,
  baseline: BaselineMetrics
): number {
  let count = 0;
  
  // Average symptom severity increases by ≥1 level
  if (current.avgSymptomSeverity >= baseline.avgSymptomSeverity + 1) {
    count++;
  }
  
  // Skin state worsens (tier increases)
  if (current.skinTier > baseline.skinTier) {
    count++;
  }
  
  // Pain category increases
  if (current.painTier > baseline.painTier) {
    count++;
  }
  
  // Sleep worsens by ≥1 tier
  if (current.sleepTier > baseline.sleepTier) {
    count++;
  }
  
  // Mood worsens by ≥1 tier
  if (current.moodTier > baseline.moodTier) {
    count++;
  }
  
  return count;
}

/**
 * Check if a day meets STRICT peak flare criteria
 * ALL must be true:
 * - Pain ≥7
 * - Skin state = red (tier 4)
 * - ≥2 symptoms marked Severe
 */
function meetsPeakFlareCriteria(metrics: DailyMetrics): boolean {
  return (
    metrics.rawPain >= 7 &&
    metrics.skinTier === 4 && // red
    metrics.severeSymptomCount >= 2
  );
}

/**
 * Group check-ins by date and calculate all daily metrics
 */
function calculateAllDailyMetrics(checkIns: CheckInData[]): DailyMetrics[] {
  const byDate = new Map<string, CheckInData[]>();
  
  for (const checkIn of checkIns) {
    const date = checkIn.created_at.split('T')[0];
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(checkIn);
  }
  
  const metrics: DailyMetrics[] = [];
  for (const [, dayCheckIns] of byDate) {
    metrics.push(calculateDailyMetrics(dayCheckIns));
  }
  
  return metrics.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Determine baseline confidence
 */
export function getBaselineConfidence(checkInCount: number): BaselineConfidence {
  if (checkInCount < 7) return 'early';
  if (checkInCount < 14) return 'provisional';
  return 'mature';
}

/**
 * Main flare detection algorithm
 */
export function analyzeFlareState(checkIns: CheckInData[]): FlareAnalysis {
  if (checkIns.length === 0) {
    return createEmptyAnalysis();
  }
  
  const allMetrics = calculateAllDailyMetrics(checkIns);
  const confidence = getBaselineConfidence(checkIns.length);
  
  // Build daily flare states with the new multi-day logic
  const dailyFlareStates: DailyFlareState[] = [];
  const flareEpisodes: FlareEpisode[] = [];
  
  // Track consecutive worsening days
  let consecutiveWorseningDays = 0;
  let consecutivePeakDays = 0;
  let currentFlareStartIdx: number | null = null;
  let peakIdx: number | null = null;
  let peakScore = 0;
  
  for (let i = 0; i < allMetrics.length; i++) {
    const metrics = allMetrics[i];
    const baseline = calculate7DayBaseline(allMetrics, i);
    
    let flareState: FlareState = 'stable';
    let isInFlareEpisode = false;
    let explanation: string | undefined;
    
    // Calculate burden score for compatibility
    const burdenScore = metrics.avgSymptomSeverity + (metrics.rawSkinIntensity / 5) * 3;
    
    if (confidence === 'early' || baseline === null) {
      // Not enough data - default to stable
      flareState = 'stable';
      explanation = 'Not enough data to detect trends yet.';
    } else {
      const worseningCount = countWorseningMetrics(metrics, baseline);
      const isWorsening = worseningCount >= 2; // At least 2 metrics worsening
      const meetsPeak = meetsPeakFlareCriteria(metrics);
      
      if (isWorsening) {
        consecutiveWorseningDays++;
        
        if (meetsPeak) {
          consecutivePeakDays++;
        } else {
          consecutivePeakDays = 0;
        }
        
        if (consecutiveWorseningDays === 1) {
          // Just 1 day - unstable (single-day spike)
          flareState = 'unstable';
          explanation = 'Single-day symptom change detected. Monitoring for trends.';
        } else if (consecutiveWorseningDays === 2) {
          // 2 consecutive days - early flare
          flareState = 'early_flare';
          isInFlareEpisode = true;
          if (currentFlareStartIdx === null) {
            currentFlareStartIdx = i - 1; // Started yesterday
          }
          explanation = 'A flare is detected based on sustained symptom worsening over multiple days — not a single bad day.';
        } else if (consecutiveWorseningDays >= 3) {
          // ≥3 consecutive days
          isInFlareEpisode = true;
          
          // Check for peak flare (strict criteria for ≥3 days)
          if (consecutivePeakDays >= 3) {
            flareState = 'peak_flare';
            explanation = 'Peak flare: severe symptoms persisting for 3+ days with pain ≥7, red skin, and multiple severe symptoms.';
          } else {
            flareState = 'active_flare';
            explanation = 'A flare is detected based on sustained symptom worsening over multiple days — not a single bad day.';
          }
        }
        
        // Track peak within episode
        if (isInFlareEpisode && burdenScore > peakScore) {
          peakScore = burdenScore;
          peakIdx = i;
        }
      } else {
        // Not worsening today
        
        // Check if we just ended a flare
        if (consecutiveWorseningDays >= 2 && currentFlareStartIdx !== null) {
          // We had a valid flare that just ended
          const startMetrics = allMetrics[currentFlareStartIdx];
          const endMetrics = allMetrics[i - 1];
          
          flareEpisodes.push({
            startDate: startMetrics.date,
            endDate: endMetrics.date,
            peakDate: peakIdx !== null ? allMetrics[peakIdx].date : endMetrics.date,
            durationDays: consecutiveWorseningDays,
            peakBurdenScore: peakScore,
            isActive: false,
            isPaused: false,
          });
          
          // This day is recovering
          flareState = 'recovering';
          explanation = 'Symptoms improving after flare period.';
        } else if (consecutiveWorseningDays === 1) {
          // Single spike that didn't continue - just stable now
          flareState = 'stable';
        }
        
        // Reset counters
        consecutiveWorseningDays = 0;
        consecutivePeakDays = 0;
        currentFlareStartIdx = null;
        peakIdx = null;
        peakScore = 0;
      }
    }
    
    // Update previous day's state if needed (for early_flare retroactive)
    if (consecutiveWorseningDays === 2 && dailyFlareStates.length > 0) {
      const prevState = dailyFlareStates[dailyFlareStates.length - 1];
      if (prevState.flareState === 'unstable') {
        prevState.flareState = 'early_flare';
        prevState.isInFlareEpisode = true;
        prevState.explanation = 'A flare is detected based on sustained symptom worsening over multiple days — not a single bad day.';
      }
    }
    
    dailyFlareStates.push({
      date: metrics.date,
      burdenScore,
      rollingAverage3: baseline?.avgSymptomSeverity ?? null,
      flareState,
      isInFlareEpisode,
      explanation,
    });
  }
  
  // Handle ongoing flare at end of data
  if (consecutiveWorseningDays >= 2 && currentFlareStartIdx !== null) {
    const startMetrics = allMetrics[currentFlareStartIdx];
    const endMetrics = allMetrics[allMetrics.length - 1];
    
    flareEpisodes.push({
      startDate: startMetrics.date,
      endDate: null, // Still active
      peakDate: peakIdx !== null ? allMetrics[peakIdx].date : endMetrics.date,
      durationDays: consecutiveWorseningDays,
      peakBurdenScore: peakScore,
      isActive: true,
      isPaused: false,
    });
  }
  
  // Determine current state
  const currentState = dailyFlareStates.length > 0
    ? dailyFlareStates[dailyFlareStates.length - 1].flareState
    : 'stable';
  
  const activeFlare = flareEpisodes.find(ep => ep.isActive);
  
  // Convert to legacy DailyBurden format for compatibility
  const dailyBurdens: DailyBurden[] = allMetrics.map(m => ({
    date: m.date,
    score: m.avgSymptomSeverity + (m.rawSkinIntensity / 5) * 3,
    skinIntensity: m.rawSkinIntensity,
    symptomScore: m.avgSymptomSeverity * 3, // rough estimate
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
    isInActiveFlare: activeFlare !== undefined,
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
  const metrics = calculateAllDailyMetrics(checkIns);
  return metrics.map(m => ({
    date: m.date,
    score: m.avgSymptomSeverity + (m.rawSkinIntensity / 5) * 3,
    skinIntensity: m.rawSkinIntensity,
    symptomScore: m.avgSymptomSeverity * 3,
  }));
}

export function calculateDailyBurdenScore(checkIn: CheckInData): number {
  const metrics = calculateDailyMetrics([checkIn]);
  return metrics.avgSymptomSeverity + (metrics.rawSkinIntensity / 5) * 3;
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
  // This is now handled internally by analyzeFlareState
  return [];
}

export function assignDailyFlareStates(
  dailyBurdens: DailyBurden[],
  baselineBurdenScore: number | null,
  flareThreshold: number | null,
  flareEpisodes: FlareEpisode[],
  confidence: BaselineConfidence
): DailyFlareState[] {
  // This is now handled internally by analyzeFlareState
  return dailyBurdens.map(b => ({
    date: b.date,
    burdenScore: b.score,
    rollingAverage3: null,
    flareState: 'stable' as FlareState,
    isInFlareEpisode: false,
  }));
}
