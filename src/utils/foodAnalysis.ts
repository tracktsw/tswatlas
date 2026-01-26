import { CheckIn } from '@/contexts/UserDataContext';
import { format, subDays, addDays, differenceInDays, parseISO } from 'date-fns';

// Types for the new food analysis
export type FoodPattern = 'often_worse' | 'often_better' | 'mixed' | 'no_pattern' | 'insufficient_data';
export type FoodConfidence = 'low' | 'medium' | 'high';

export interface FoodAnalysisResult {
  name: string;
  count: number;
  daysWorseAfter: number;
  daysBetterAfter: number;
  daysNeutralAfter: number;
  pattern: FoodPattern;
  consistency: number;
  confidence: FoodConfidence;
  // For display purposes
  analyzableExposures: number;
}

const MINIMUM_LOGS_THRESHOLD = 3;
const WORSE_THRESHOLD = 0.5; // intensity units above baseline to count as "worse"
const BETTER_THRESHOLD = -0.5; // intensity units below baseline to count as "better"
const REACTION_DAYS = [1, 2, 3]; // Look at D+1, D+2, D+3
const LOCAL_BASELINE_WINDOW = 7; // ±7 days for local baseline

/**
 * Build a map of date string -> average skin intensity for that day
 */
function buildDateIntensityMap(checkIns: CheckIn[]): Map<string, number> {
  const dateMap = new Map<string, { total: number; count: number }>();
  
  checkIns.forEach(checkIn => {
    const date = checkIn.timestamp.split('T')[0];
    const intensity = checkIn.skinIntensity ?? (5 - checkIn.skinFeeling);
    
    if (!dateMap.has(date)) {
      dateMap.set(date, { total: 0, count: 0 });
    }
    const entry = dateMap.get(date)!;
    entry.total += intensity;
    entry.count += 1;
  });
  
  const result = new Map<string, number>();
  dateMap.forEach((value, key) => {
    result.set(key, value.total / value.count);
  });
  
  return result;
}

/**
 * Build a map of date string -> set of foods logged that day
 */
function buildDateFoodMap(checkIns: CheckIn[]): Map<string, Set<string>> {
  const dateMap = new Map<string, Set<string>>();
  
  checkIns.forEach(checkIn => {
    const date = checkIn.timestamp.split('T')[0];
    const triggers = checkIn.triggers || [];
    
    triggers.forEach(trigger => {
      if (trigger.startsWith('food:')) {
        const foodName = trigger.slice(5).trim().toLowerCase();
        if (foodName) {
          if (!dateMap.has(date)) {
            dateMap.set(date, new Set());
          }
          dateMap.get(date)!.add(foodName);
        }
      }
    });
  });
  
  return dateMap;
}

/**
 * Get local baseline: average intensity of days within ±window that did NOT have the specified food
 */
function getLocalBaseline(
  intensityMap: Map<string, number>,
  foodMap: Map<string, Set<string>>,
  targetDate: string,
  excludeFood: string,
  windowDays: number = LOCAL_BASELINE_WINDOW
): number | null {
  const targetDateObj = parseISO(targetDate);
  const baselineDays: number[] = [];
  
  for (let offset = -windowDays; offset <= windowDays; offset++) {
    if (offset === 0) continue; // Skip the target date itself
    
    const checkDate = format(addDays(targetDateObj, offset), 'yyyy-MM-dd');
    const intensity = intensityMap.get(checkDate);
    const foodsOnDay = foodMap.get(checkDate);
    
    // Only include days that have intensity data AND don't have the excluded food
    if (intensity !== undefined) {
      const hasExcludedFood = foodsOnDay?.has(excludeFood) || false;
      if (!hasExcludedFood) {
        baselineDays.push(intensity);
      }
    }
  }
  
  if (baselineDays.length === 0) {
    return null;
  }
  
  return baselineDays.reduce((a, b) => a + b, 0) / baselineDays.length;
}

/**
 * Get average intensity for the reaction window (D+1, D+2, D+3)
 */
function getPostFoodIntensity(
  intensityMap: Map<string, number>,
  exposureDate: string
): number | null {
  const exposureDateObj = parseISO(exposureDate);
  const intensities: number[] = [];
  
  for (const dayOffset of REACTION_DAYS) {
    const checkDate = format(addDays(exposureDateObj, dayOffset), 'yyyy-MM-dd');
    const intensity = intensityMap.get(checkDate);
    if (intensity !== undefined) {
      intensities.push(intensity);
    }
  }
  
  if (intensities.length === 0) {
    return null;
  }
  
  return intensities.reduce((a, b) => a + b, 0) / intensities.length;
}

/**
 * Classify an exposure outcome
 */
function classifyExposure(
  postFoodIntensity: number,
  localBaseline: number
): 'worse' | 'better' | 'neutral' {
  const delta = postFoodIntensity - localBaseline;
  
  if (delta >= WORSE_THRESHOLD) {
    return 'worse';
  } else if (delta <= BETTER_THRESHOLD) {
    return 'better';
  }
  return 'neutral';
}

/**
 * Calculate pattern from exposure outcomes
 */
function calculatePattern(
  worseCount: number,
  betterCount: number,
  neutralCount: number,
  total: number
): FoodPattern {
  if (total === 0) {
    return 'insufficient_data';
  }
  
  const worseRatio = worseCount / total;
  const betterRatio = betterCount / total;
  
  // ≥60% worse → "often worse"
  if (worseRatio >= 0.6) {
    return 'often_worse';
  }
  
  // ≥60% better → "often better"
  if (betterRatio >= 0.6) {
    return 'often_better';
  }
  
  // If neither dominates but there's meaningful variation
  if (worseRatio + betterRatio >= 0.5) {
    return 'mixed';
  }
  
  // Mostly neutral or unclear
  return 'no_pattern';
}

/**
 * Calculate consistency score (0-1)
 * Higher when outcomes are more uniform
 */
function calculateConsistency(
  worseCount: number,
  betterCount: number,
  neutralCount: number,
  total: number
): number {
  if (total === 0) return 0;
  
  const worseRatio = worseCount / total;
  const betterRatio = betterCount / total;
  const neutralRatio = neutralCount / total;
  
  // Consistency is the maximum of the three ratios
  // A food that's 5/5 worse has consistency 1.0
  // A food that's 2 worse, 2 better, 1 neutral has consistency 0.4
  return Math.max(worseRatio, betterRatio, neutralRatio);
}

/**
 * Calculate confidence level
 */
function calculateConfidence(
  count: number,
  consistency: number
): FoodConfidence {
  if (count <= 4) {
    return 'low';
  }
  
  if (count <= 7) {
    return consistency >= 0.6 ? 'medium' : 'low';
  }
  
  // count >= 8
  return consistency >= 0.6 ? 'high' : 'medium';
}

/**
 * Main analysis function: analyze all foods with delayed reaction logic
 */
export function analyzeFoodReactions(
  checkIns: CheckIn[],
  periodDays: number
): FoodAnalysisResult[] {
  // Filter check-ins by time period
  const now = new Date();
  const cutoffDate = subDays(now, periodDays);
  
  const filteredCheckIns = periodDays >= 9999
    ? checkIns
    : checkIns.filter(c => new Date(c.timestamp) >= cutoffDate);
  
  if (filteredCheckIns.length === 0) {
    return [];
  }
  
  // Build lookup maps
  const intensityMap = buildDateIntensityMap(filteredCheckIns);
  const foodMap = buildDateFoodMap(filteredCheckIns);
  
  // Collect all unique foods and their log dates
  const foodLogDates = new Map<string, Set<string>>();
  
  foodMap.forEach((foods, date) => {
    foods.forEach(food => {
      if (!foodLogDates.has(food)) {
        foodLogDates.set(food, new Set());
      }
      foodLogDates.get(food)!.add(date);
    });
  });
  
  const results: FoodAnalysisResult[] = [];
  
  foodLogDates.forEach((dates, foodName) => {
    const count = dates.size;
    
    // Not enough logs
    if (count < MINIMUM_LOGS_THRESHOLD) {
      results.push({
        name: foodName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        count,
        daysWorseAfter: 0,
        daysBetterAfter: 0,
        daysNeutralAfter: 0,
        pattern: 'insufficient_data',
        consistency: 0,
        confidence: 'low',
        analyzableExposures: 0,
      });
      return;
    }
    
    // Analyze each exposure
    let worseCount = 0;
    let betterCount = 0;
    let neutralCount = 0;
    let analyzableExposures = 0;
    
    // Sort dates to handle consecutive days properly
    const sortedDates = Array.from(dates).sort();
    const processedDates = new Set<string>();
    
    for (const exposureDate of sortedDates) {
      // Skip if this date was already counted as part of a consecutive exposure
      if (processedDates.has(exposureDate)) continue;
      
      // Mark consecutive days as post-exposure (don't count as new exposures)
      const exposureDateObj = parseISO(exposureDate);
      for (let i = 1; i <= 3; i++) {
        const nextDate = format(addDays(exposureDateObj, i), 'yyyy-MM-dd');
        if (dates.has(nextDate)) {
          processedDates.add(nextDate);
        }
      }
      
      // Get post-food intensity (D+1, D+2, D+3)
      const postFoodIntensity = getPostFoodIntensity(intensityMap, exposureDate);
      if (postFoodIntensity === null) {
        continue; // No intensity data in reaction window
      }
      
      // Get local baseline (nearby days without this food)
      const localBaseline = getLocalBaseline(intensityMap, foodMap, exposureDate, foodName);
      if (localBaseline === null) {
        continue; // Cannot establish baseline
      }
      
      // Classify this exposure
      const outcome = classifyExposure(postFoodIntensity, localBaseline);
      analyzableExposures++;
      
      if (outcome === 'worse') {
        worseCount++;
      } else if (outcome === 'better') {
        betterCount++;
      } else {
        neutralCount++;
      }
    }
    
    // Calculate metrics
    const pattern = analyzableExposures >= MINIMUM_LOGS_THRESHOLD
      ? calculatePattern(worseCount, betterCount, neutralCount, analyzableExposures)
      : 'insufficient_data';
    
    const consistency = calculateConsistency(worseCount, betterCount, neutralCount, analyzableExposures);
    const confidence = calculateConfidence(count, consistency);
    
    results.push({
      name: foodName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      count,
      daysWorseAfter: worseCount,
      daysBetterAfter: betterCount,
      daysNeutralAfter: neutralCount,
      pattern,
      consistency,
      confidence,
      analyzableExposures,
    });
  });
  
  // Sort by: pattern severity × consistency × log(count)
  // Foods with "often_worse" + high consistency + high count come first
  results.sort((a, b) => {
    // Insufficient data always goes last
    if (a.pattern === 'insufficient_data' && b.pattern !== 'insufficient_data') return 1;
    if (b.pattern === 'insufficient_data' && a.pattern !== 'insufficient_data') return -1;
    
    // Score calculation
    const patternWeight = (p: FoodPattern): number => {
      switch (p) {
        case 'often_worse': return 1.0;
        case 'mixed': return 0.5;
        case 'often_better': return 0.3;
        case 'no_pattern': return 0.2;
        case 'insufficient_data': return 0;
      }
    };
    
    const scoreA = patternWeight(a.pattern) * a.consistency * Math.log(a.count + 1);
    const scoreB = patternWeight(b.pattern) * b.consistency * Math.log(b.count + 1);
    
    return scoreB - scoreA;
  });
  
  return results;
}

/**
 * Get pattern display label (for AI coach context)
 */
export function getPatternLabel(pattern: FoodPattern): string {
  switch (pattern) {
    case 'often_worse':
      return 'often followed by worse symptoms';
    case 'often_better':
      return 'often followed by improvement';
    case 'mixed':
      return 'mixed reactions observed';
    case 'no_pattern':
      return 'no clear pattern detected';
    case 'insufficient_data':
      return 'not enough data yet';
  }
}

/**
 * Get confidence display label
 */
export function getConfidenceLabel(confidence: FoodConfidence): string {
  switch (confidence) {
    case 'high':
      return 'High confidence';
    case 'medium':
      return 'Moderate confidence';
    case 'low':
      return 'Preliminary';
  }
}
