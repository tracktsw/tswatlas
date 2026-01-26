import { CheckIn } from '@/contexts/UserDataContext';
import { format, subDays, addDays, parseISO } from 'date-fns';

// Types for product analysis (mirrors food analysis)
export type ProductPattern = 'often_worse' | 'often_better' | 'mixed' | 'no_pattern' | 'insufficient_data';
export type ProductConfidence = 'low' | 'medium' | 'high';

export interface ProductAnalysisResult {
  name: string;
  count: number;
  daysWorseAfter: number;
  daysBetterAfter: number;
  daysNeutralAfter: number;
  pattern: ProductPattern;
  consistency: number;
  confidence: ProductConfidence;
  analyzableExposures: number;
}

const MINIMUM_LOGS_THRESHOLD = 3;
const WORSE_THRESHOLD = 0.5;
const BETTER_THRESHOLD = -0.5;
const REACTION_DAYS = [1, 2, 3];
const LOCAL_BASELINE_WINDOW = 7;

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
 * Build a map of date string -> set of products logged that day
 */
function buildDateProductMap(checkIns: CheckIn[]): Map<string, Set<string>> {
  const dateMap = new Map<string, Set<string>>();
  
  checkIns.forEach(checkIn => {
    const date = checkIn.timestamp.split('T')[0];
    const triggers = checkIn.triggers || [];
    
    triggers.forEach(trigger => {
      if (trigger.startsWith('product:')) {
        const productName = trigger.slice(8).trim().toLowerCase();
        if (productName) {
          if (!dateMap.has(date)) {
            dateMap.set(date, new Set());
          }
          dateMap.get(date)!.add(productName);
        }
      }
    });
  });
  
  return dateMap;
}

/**
 * Get local baseline: average intensity of days within ±window that did NOT have the specified product
 */
function getLocalBaseline(
  intensityMap: Map<string, number>,
  productMap: Map<string, Set<string>>,
  targetDate: string,
  excludeProduct: string,
  windowDays: number = LOCAL_BASELINE_WINDOW
): number | null {
  const targetDateObj = parseISO(targetDate);
  const baselineDays: number[] = [];
  
  for (let offset = -windowDays; offset <= windowDays; offset++) {
    if (offset === 0) continue;
    
    const checkDate = format(addDays(targetDateObj, offset), 'yyyy-MM-dd');
    const intensity = intensityMap.get(checkDate);
    const productsOnDay = productMap.get(checkDate);
    
    if (intensity !== undefined) {
      const hasExcludedProduct = productsOnDay?.has(excludeProduct) || false;
      if (!hasExcludedProduct) {
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
function getPostProductIntensity(
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
  postProductIntensity: number,
  localBaseline: number
): 'worse' | 'better' | 'neutral' {
  const delta = postProductIntensity - localBaseline;
  
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
): ProductPattern {
  if (total === 0) {
    return 'insufficient_data';
  }
  
  const worseRatio = worseCount / total;
  const betterRatio = betterCount / total;
  
  if (worseRatio >= 0.6) {
    return 'often_worse';
  }
  
  if (betterRatio >= 0.6) {
    return 'often_better';
  }
  
  if (worseRatio + betterRatio >= 0.5) {
    return 'mixed';
  }
  
  return 'no_pattern';
}

/**
 * Calculate consistency score (0-1)
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
  
  return Math.max(worseRatio, betterRatio, neutralRatio);
}

/**
 * Calculate confidence level
 */
function calculateConfidence(
  count: number,
  consistency: number
): ProductConfidence {
  if (count <= 4) {
    return 'low';
  }
  
  if (count <= 7) {
    return consistency >= 0.6 ? 'medium' : 'low';
  }
  
  return consistency >= 0.6 ? 'high' : 'medium';
}

/**
 * Main analysis function: analyze all products with delayed reaction logic
 */
export function analyzeProductReactions(
  checkIns: CheckIn[],
  periodDays: number
): ProductAnalysisResult[] {
  const now = new Date();
  const cutoffDate = subDays(now, periodDays);
  
  const filteredCheckIns = periodDays >= 9999
    ? checkIns
    : checkIns.filter(c => new Date(c.timestamp) >= cutoffDate);
  
  if (filteredCheckIns.length === 0) {
    return [];
  }
  
  const intensityMap = buildDateIntensityMap(filteredCheckIns);
  const productMap = buildDateProductMap(filteredCheckIns);
  
  const productLogDates = new Map<string, Set<string>>();
  
  productMap.forEach((products, date) => {
    products.forEach(product => {
      if (!productLogDates.has(product)) {
        productLogDates.set(product, new Set());
      }
      productLogDates.get(product)!.add(date);
    });
  });
  
  const results: ProductAnalysisResult[] = [];
  
  productLogDates.forEach((dates, productName) => {
    const count = dates.size;
    
    if (count < MINIMUM_LOGS_THRESHOLD) {
      results.push({
        name: productName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
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
    
    let worseCount = 0;
    let betterCount = 0;
    let neutralCount = 0;
    let analyzableExposures = 0;
    
    const sortedDates = Array.from(dates).sort();
    const processedDates = new Set<string>();
    
    for (const exposureDate of sortedDates) {
      if (processedDates.has(exposureDate)) continue;
      
      const exposureDateObj = parseISO(exposureDate);
      for (let i = 1; i <= 3; i++) {
        const nextDate = format(addDays(exposureDateObj, i), 'yyyy-MM-dd');
        if (dates.has(nextDate)) {
          processedDates.add(nextDate);
        }
      }
      
      const postProductIntensity = getPostProductIntensity(intensityMap, exposureDate);
      if (postProductIntensity === null) {
        continue;
      }
      
      const localBaseline = getLocalBaseline(intensityMap, productMap, exposureDate, productName);
      if (localBaseline === null) {
        continue;
      }
      
      const outcome = classifyExposure(postProductIntensity, localBaseline);
      analyzableExposures++;
      
      if (outcome === 'worse') {
        worseCount++;
      } else if (outcome === 'better') {
        betterCount++;
      } else {
        neutralCount++;
      }
    }
    
    const pattern = analyzableExposures >= MINIMUM_LOGS_THRESHOLD
      ? calculatePattern(worseCount, betterCount, neutralCount, analyzableExposures)
      : 'insufficient_data';
    
    const consistency = calculateConsistency(worseCount, betterCount, neutralCount, analyzableExposures);
    const confidence = calculateConfidence(count, consistency);
    
    results.push({
      name: productName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
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
  
  results.sort((a, b) => {
    if (a.pattern === 'insufficient_data' && b.pattern !== 'insufficient_data') return 1;
    if (b.pattern === 'insufficient_data' && a.pattern !== 'insufficient_data') return -1;
    
    const patternWeight = (p: ProductPattern): number => {
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
 * Get pattern display label
 */
export function getProductPatternLabel(pattern: ProductPattern): string {
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
export function getProductConfidenceLabel(confidence: ProductConfidence): string {
  switch (confidence) {
    case 'high':
      return 'High confidence';
    case 'medium':
      return 'Moderate confidence';
    case 'low':
      return 'Preliminary';
  }
}
