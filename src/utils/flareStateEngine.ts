/**
 * Flare State Engine (Trend-Based, 4-State System)
 * 
 * States: Stable, Early Flare, Active Flare, Recovering
 * 
 * Key principles:
 * - Single bad days NEVER trigger flares
 * - Based on RECENT trends, not lifetime data
 * - Recovery OVERRIDES historic severity
 * - Never show "Active flare" if last 3-5 days show improvement
 */

export type FlareState = 
  | 'stable' 
  | 'stable_severe' // persistently high but NOT worsening
  | 'early_flare'   // worsening trend starting (2 check-ins)
  | 'active_flare'  // confirmed flare (3+ check-ins worsening)
  | 'recovering';   // improving after flare

export type BaselineConfidence = 'early' | 'provisional' | 'mature';

// Core symptoms that matter for flare detection
const CORE_SYMPTOMS = ['itching', 'burning', 'redness', 'itch', 'burn', 'red'];

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

interface DailyMetrics {
  date: string;
  avgSeverity: number;         // average symptom severity (1-3)
  maxSeverity: number;         // max symptom severity
  painScore: number;           // 0-10
  skinIntensity: number;       // 0-5 (higher = worse)
  skinFeeling: number;         // 1-5 (higher = better)
  mood: number;                // 1-5 (higher = better)
  hasCoreSymptomModerateOrSevere: boolean;
  checkInCount: number;
}

/**
 * Calculate metrics for a single day from check-ins
 */
function calculateDailyMetrics(dayCheckIns: CheckInData[]): DailyMetrics {
  let totalSeverity = 0;
  let symptomCount = 0;
  let maxSeverity = 0;
  let maxPain = 0;
  let maxSkinIntensity = 0;
  let minSkinFeeling = 5;
  let avgMood = 3;
  let hasCoreSymptom = false;
  
  let moodSum = 0;
  let moodCount = 0;
  
  for (const checkIn of dayCheckIns) {
    // Skin metrics
    const skinIntensity = checkIn.skinIntensity ?? (5 - checkIn.skinFeeling);
    maxSkinIntensity = Math.max(maxSkinIntensity, skinIntensity);
    minSkinFeeling = Math.min(minSkinFeeling, checkIn.skinFeeling);
    
    // Pain
    const pain = checkIn.pain_score ?? 0;
    maxPain = Math.max(maxPain, pain);
    
    // Mood
    if (checkIn.mood !== undefined && checkIn.mood !== null) {
      moodSum += checkIn.mood;
      moodCount++;
    }
    
    // Symptoms
    const symptoms = checkIn.symptomsExperienced ?? [];
    for (const symptom of symptoms) {
      totalSeverity += symptom.severity;
      symptomCount++;
      maxSeverity = Math.max(maxSeverity, symptom.severity);
      
      // Check for core symptoms at moderate (2) or severe (3)
      const isCore = CORE_SYMPTOMS.some(c => 
        symptom.name.toLowerCase().includes(c)
      );
      if (isCore && symptom.severity >= 2) {
        hasCoreSymptom = true;
      }
    }
  }
  
  avgMood = moodCount > 0 ? moodSum / moodCount : 3;
  
  return {
    date: dayCheckIns[0].created_at.split('T')[0],
    avgSeverity: symptomCount > 0 ? totalSeverity / symptomCount : 0,
    maxSeverity,
    painScore: maxPain,
    skinIntensity: maxSkinIntensity,
    skinFeeling: minSkinFeeling,
    mood: avgMood,
    hasCoreSymptomModerateOrSevere: hasCoreSymptom,
    checkInCount: dayCheckIns.length,
  };
}

/**
 * Group check-ins by date and calculate daily metrics
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
 * Check if severity is worsening across consecutive days
 * Returns the count of consecutive worsening days from the end
 */
function getConsecutiveWorseningCount(metrics: DailyMetrics[], field: 'avgSeverity' | 'painScore'): number {
  if (metrics.length < 2) return 0;
  
  let count = 0;
  for (let i = metrics.length - 1; i > 0; i--) {
    const current = metrics[i][field];
    const previous = metrics[i - 1][field];
    
    if (current > previous) {
      count++;
    } else {
      break;
    }
  }
  
  return count;
}

/**
 * Check if there's an improving trend (for recovery detection)
 * Returns count of consecutive improving days from the end
 */
function getConsecutiveImprovingCount(metrics: DailyMetrics[]): number {
  if (metrics.length < 2) return 0;
  
  let count = 0;
  for (let i = metrics.length - 1; i > 0; i--) {
    const current = metrics[i];
    const previous = metrics[i - 1];
    
    // Improvement: severity decreasing OR pain decreasing OR skin feeling improving
    const severityImproving = current.avgSeverity < previous.avgSeverity;
    const painImproving = current.painScore < previous.painScore;
    const skinImproving = current.skinFeeling > previous.skinFeeling;
    const moodImproving = current.mood > previous.mood;
    
    if (severityImproving || painImproving || skinImproving || moodImproving) {
      count++;
    } else {
      break;
    }
  }
  
  return count;
}

/**
 * Check if recent days have core symptoms at moderate/severe level
 */
function hasCoreSymptomOnMostDays(metrics: DailyMetrics[], lookbackDays: number = 3): boolean {
  const recent = metrics.slice(-lookbackDays);
  if (recent.length === 0) return false;
  
  const daysWithCoreSymptom = recent.filter(m => m.hasCoreSymptomModerateOrSevere).length;
  return daysWithCoreSymptom >= Math.ceil(recent.length / 2); // "most days" = more than half
}

/**
 * Check if average severity trend is worsening (not flat)
 */
function isSeverityTrendWorsening(metrics: DailyMetrics[], lookbackDays: number = 5): boolean {
  const recent = metrics.slice(-lookbackDays);
  if (recent.length < 2) return false;
  
  // Compare first half average to second half average
  const midpoint = Math.floor(recent.length / 2);
  const firstHalf = recent.slice(0, midpoint);
  const secondHalf = recent.slice(midpoint);
  
  const firstAvg = firstHalf.reduce((s, m) => s + m.avgSeverity, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((s, m) => s + m.avgSeverity, 0) / secondHalf.length;
  
  return secondAvg > firstAvg + 0.1; // Not flat, actually worsening
}

/**
 * Get the RECENT trend direction based on the last few days only
 * This is more useful than comparing first-half vs second-half for detecting current state
 */
function getRecentTrendDirection(
  metrics: DailyMetrics[], 
  field: 'avgSeverity' | 'painScore' | 'skinIntensity',
  lookback: number = 3
): 'worsening' | 'stable' | 'improving' {
  if (metrics.length < lookback) return 'stable';
  
  const recentDays = metrics.slice(-lookback);
  let worseningCount = 0;
  let improvingCount = 0;
  
  for (let i = 1; i < recentDays.length; i++) {
    const prev = recentDays[i - 1][field];
    const curr = recentDays[i][field];
    if (prev === null || curr === null) continue;
    
    if (curr > prev + 0.5) worseningCount++;
    else if (curr < prev - 0.5) improvingCount++;
  }
  
  // Need clear majority to determine trend
  if (worseningCount >= lookback - 1) return 'worsening';
  if (improvingCount >= lookback - 1) return 'improving';
  return 'stable';
}

/**
 * Check if user is in STABLE-SEVERE state
 * TRUE if:
 * - Persistently high severity (pain ≥5 OR avg severity ≥2 OR skin intensity ≥3) for ≥7 days
 * - Recent trend (last 3 days) is NOT worsening (stable or improving)
 * This represents their current baseline, not an active flare
 */
function shouldBeStableSevere(metrics: DailyMetrics[]): boolean {
  if (metrics.length < 7) return false; // Need at least 7 days of data
  
  const last7Days = metrics.slice(-7);
  
  // Check for persistently high severity
  const daysWithHighSeverity = last7Days.filter(m => 
    (m.painScore !== null && m.painScore >= 5) || 
    m.avgSeverity >= 2 || 
    (m.skinIntensity !== null && m.skinIntensity >= 3)
  ).length;
  
  // Need at least 5 of 7 days with high severity to be "persistently high"
  if (daysWithHighSeverity < 5) return false;
  
  // Check RECENT trend direction (last 3 days) - key distinction from active flare
  // If currently worsening, it's a flare, not stable-severe
  const recentPainTrend = getRecentTrendDirection(metrics, 'painScore', 3);
  const recentSeverityTrend = getRecentTrendDirection(metrics, 'avgSeverity', 3);
  
  // If BOTH pain AND severity are actively worsening in recent days, it's a flare
  if (recentPainTrend === 'worsening' && recentSeverityTrend === 'worsening') return false;
  
  // Check for consecutive worsening - but only if it's still active
  const severityWorseningCount = getConsecutiveWorseningCount(metrics, 'avgSeverity');
  const painWorseningCount = getConsecutiveWorseningCount(metrics, 'painScore');
  
  // If there's active consecutive worsening (3+ days), it's a flare
  if (severityWorseningCount >= 3 || painWorseningCount >= 3) return false;
  
  return true;
}

/**
 * Check if user should be in STABLE state (exit flare completely)
 * ALL must be true:
 * - No worsening trend for ≥5 days
 * - Pain scores remain low (≤3)
 * - Skin feeling is stable or improving
 * - No new severe symptom spikes
 */
function shouldBeStable(metrics: DailyMetrics[]): boolean {
  if (metrics.length < 5) return true; // Not enough data, default to stable
  
  const last5Days = metrics.slice(-5);
  
  // No worsening trend for ≥5 days
  const worseningCount = getConsecutiveWorseningCount(metrics, 'avgSeverity');
  if (worseningCount >= 2) return false;
  
  // Pain scores remain low (≤3)
  const allPainLow = last5Days.every(m => m.painScore <= 3);
  if (!allPainLow) return false;
  
  // Skin feeling stable or improving (check last few days aren't getting worse)
  const skinWorsening = last5Days.some((m, i) => {
    if (i === 0) return false;
    return m.skinFeeling < last5Days[i - 1].skinFeeling;
  });
  // Allow some fluctuation, but not consistent worsening
  const skinConsistentlyWorsening = getConsecutiveWorseningCount(
    last5Days.map(m => ({ ...m, avgSeverity: 5 - m.skinFeeling, painScore: 0 })), 
    'avgSeverity'
  ) >= 2;
  if (skinConsistentlyWorsening) return false;
  
  // No severe symptom spikes
  const hasSevereSpike = last5Days.some(m => m.maxSeverity >= 3);
  if (hasSevereSpike) return false;
  
  return true;
}

/**
 * Check if user should be RECOVERING
 * ANY of these conditions:
 * - Severity trend improves for ≥2 consecutive check-ins
 * - Pain scores decrease or remain low
 * - Skin feeling improves
 * - Mood stabilises or improves
 */
function shouldBeRecovering(metrics: DailyMetrics[], wasInFlare: boolean): boolean {
  if (!wasInFlare) return false; // Can only recover if was in flare
  if (metrics.length < 2) return false;
  
  const improvingCount = getConsecutiveImprovingCount(metrics);
  if (improvingCount >= 2) return true;
  
  const last3Days = metrics.slice(-3);
  if (last3Days.length < 2) return false;
  
  // Pain decreasing or low
  const painDecreasing = last3Days[last3Days.length - 1].painScore < last3Days[0].painScore;
  const painLow = last3Days.every(m => m.painScore <= 3);
  if (painDecreasing || painLow) return true;
  
  // Skin feeling improving (any improvement in last 3 days)
  const skinImproving = last3Days[last3Days.length - 1].skinFeeling > last3Days[0].skinFeeling;
  if (skinImproving) return true;
  
  // Mood stabilising or improving
  const moodImproving = last3Days[last3Days.length - 1].mood >= last3Days[0].mood;
  if (moodImproving && last3Days[last3Days.length - 1].mood >= 3) return true;
  
  return false;
}

/**
 * Check if user should be in ACTIVE FLARE
 * ALL must be true:
 * - Symptom severity worsening across ≥3 consecutive check-ins OR pain increases ≥3
 * - AND average severity trend is worsening (not flat)
 * - AND core symptom (itching, burning, redness) is Moderate or Severe on most days
 * 
 * IMPORTANT: Never if last 3-5 days show improvement!
 */
function shouldBeActiveFlare(metrics: DailyMetrics[]): boolean {
  if (metrics.length < 3) return false;
  
  // FIRST: Check if last 3-5 days show improvement - if so, NEVER active flare
  const improvingCount = getConsecutiveImprovingCount(metrics);
  if (improvingCount >= 2) return false;
  
  // Check worsening trends
  const severityWorseningCount = getConsecutiveWorseningCount(metrics, 'avgSeverity');
  const painWorseningCount = getConsecutiveWorseningCount(metrics, 'painScore');
  
  const hasWorseningTrend = severityWorseningCount >= 3 || painWorseningCount >= 3;
  if (!hasWorseningTrend) return false;
  
  // Check severity trend is actually worsening (not flat)
  if (!isSeverityTrendWorsening(metrics)) return false;
  
  // Check for core symptoms on most days
  if (!hasCoreSymptomOnMostDays(metrics)) return false;
  
  return true;
}

/**
 * Check if user is in EARLY FLARE (worsening starting, 2 check-ins)
 */
function shouldBeEarlyFlare(metrics: DailyMetrics[]): boolean {
  if (metrics.length < 2) return false;
  
  // Check if improving - if so, not a flare
  const improvingCount = getConsecutiveImprovingCount(metrics);
  if (improvingCount >= 2) return false;
  
  const severityWorseningCount = getConsecutiveWorseningCount(metrics, 'avgSeverity');
  const painWorseningCount = getConsecutiveWorseningCount(metrics, 'painScore');
  
  // 2 consecutive worsening but not yet 3
  const hasEarlyWorsening = (severityWorseningCount === 2 || painWorseningCount === 2) &&
                            severityWorseningCount < 3 && painWorseningCount < 3;
  
  return hasEarlyWorsening && hasCoreSymptomOnMostDays(metrics, 2);
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
 * Main flare analysis function
 */
export function analyzeFlareState(checkIns: CheckInData[]): FlareAnalysis {
  if (checkIns.length === 0) {
    return createEmptyAnalysis();
  }
  
  const allMetrics = calculateAllDailyMetrics(checkIns);
  const confidence = getBaselineConfidence(checkIns.length);
  
  // Build daily flare states
  const dailyFlareStates: DailyFlareState[] = [];
  const flareEpisodes: FlareEpisode[] = [];
  
  // Track flare episode
  let currentFlareStartIdx: number | null = null;
  let wasInFlare = false;
  
  for (let i = 0; i < allMetrics.length; i++) {
    const metricsUpToNow = allMetrics.slice(0, i + 1);
    const metrics = allMetrics[i];
    
    let flareState: FlareState = 'stable';
    let isInFlareEpisode = false;
    let explanation: string | undefined;
    
    // Calculate burden score for compatibility
    const burdenScore = metrics.avgSeverity + (metrics.skinIntensity / 5) * 3;
    
    if (confidence === 'early') {
      flareState = 'stable';
      explanation = 'Building baseline — need more data.';
    } else {
      // Determine state based on trend analysis
      
      // Priority 1: Check if should be STABLE (exit flare)
      if (shouldBeStable(metricsUpToNow)) {
        flareState = 'stable';
        wasInFlare = false;
        if (currentFlareStartIdx !== null) {
          // End the flare episode
          flareEpisodes.push({
            startDate: allMetrics[currentFlareStartIdx].date,
            endDate: allMetrics[i > 0 ? i - 1 : i].date,
            peakDate: allMetrics[currentFlareStartIdx].date, // Simplified
            durationDays: i - currentFlareStartIdx,
            peakBurdenScore: burdenScore,
            isActive: false,
            isPaused: false,
          });
          currentFlareStartIdx = null;
        }
        explanation = 'Symptoms stable — no active flare.';
      }
      // Priority 2: Check if RECOVERING (overrides active flare if improving)
      else if (shouldBeRecovering(metricsUpToNow, wasInFlare)) {
        flareState = 'recovering';
        isInFlareEpisode = false;
        explanation = 'Recovering from flare — symptoms improving.';
        // If we were in a flare, mark it as ended
        if (currentFlareStartIdx !== null) {
          flareEpisodes.push({
            startDate: allMetrics[currentFlareStartIdx].date,
            endDate: allMetrics[i > 0 ? i - 1 : i].date,
            peakDate: allMetrics[currentFlareStartIdx].date,
            durationDays: i - currentFlareStartIdx,
            peakBurdenScore: burdenScore,
            isActive: false,
            isPaused: false,
          });
          currentFlareStartIdx = null;
        }
      }
      // Priority 3: Check if STABLE-SEVERE (high but NOT actively worsening)
      // This must come BEFORE active_flare check — if symptoms are high but stable/improving, it's stable-severe
      else if (shouldBeStableSevere(metricsUpToNow)) {
        flareState = 'stable_severe';
        isInFlareEpisode = false;
        // If we were in a flare but now stable-severe, end the episode
        if (currentFlareStartIdx !== null) {
          flareEpisodes.push({
            startDate: allMetrics[currentFlareStartIdx].date,
            endDate: allMetrics[i > 0 ? i - 1 : i].date,
            peakDate: allMetrics[currentFlareStartIdx].date,
            durationDays: i - currentFlareStartIdx,
            peakBurdenScore: burdenScore,
            isActive: false,
            isPaused: false,
          });
          currentFlareStartIdx = null;
        }
        explanation = 'Symptoms are severe but consistent — this reflects your current baseline, not an active flare.';
      }
      // Priority 4: Check if ACTIVE FLARE
      else if (shouldBeActiveFlare(metricsUpToNow)) {
        flareState = 'active_flare';
        isInFlareEpisode = true;
        wasInFlare = true;
        if (currentFlareStartIdx === null) {
          currentFlareStartIdx = Math.max(0, i - 2); // Started ~3 days ago
        }
        explanation = 'Active flare — sustained symptom worsening detected.';
      }
      // Priority 5: Check if EARLY FLARE
      else if (shouldBeEarlyFlare(metricsUpToNow)) {
        flareState = 'early_flare';
        isInFlareEpisode = true;
        wasInFlare = true;
        if (currentFlareStartIdx === null) {
          currentFlareStartIdx = Math.max(0, i - 1);
        }
        explanation = 'Early flare signs — monitoring trend.';
      }
      // Default: STABLE
      else {
        flareState = 'stable';
        explanation = 'Symptoms stable — no concerns.';
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
      peakBurdenScore: allMetrics[allMetrics.length - 1].avgSeverity,
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
    score: m.avgSeverity + (m.skinIntensity / 5) * 3,
    skinIntensity: m.skinIntensity,
    symptomScore: m.avgSeverity * 3,
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
  const metrics = calculateAllDailyMetrics(checkIns);
  return metrics.map(m => ({
    date: m.date,
    score: m.avgSeverity + (m.skinIntensity / 5) * 3,
    skinIntensity: m.skinIntensity,
    symptomScore: m.avgSeverity * 3,
  }));
}

export function calculateDailyBurdenScore(checkIn: CheckInData): number {
  const metrics = calculateDailyMetrics([checkIn]);
  return metrics.avgSeverity + (metrics.skinIntensity / 5) * 3;
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
