import { useMemo, useState } from 'react';
import { Eye, TrendingDown, TrendingUp, CheckCircle2, ChevronDown, UtensilsCrossed, Package, AlertCircle, Info } from 'lucide-react';
import { CheckIn } from '@/contexts/UserDataContext';
import { cn } from '@/lib/utils';
import { BaselineConfidence } from '@/utils/flareStateEngine';
import { analyzeFoodReactions, FoodAnalysisResult, FoodPattern, FoodConfidence } from '@/utils/foodAnalysis';
import { analyzeProductReactions, ProductAnalysisResult, ProductPattern, ProductConfidence } from '@/utils/productAnalysis';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const triggersList = [
  // Environmental triggers
  { id: 'heat_sweat', label: 'Heat / Sweat' },
  { id: 'cold_air', label: 'Cold Air' },
  { id: 'weather_change', label: 'Weather Change' },
  { id: 'shower_hard_water', label: 'Shower / Hard Water' },
  { id: 'dust_pollen', label: 'Dust / Pollen' },
  { id: 'detergent', label: 'Detergent' },
  { id: 'fragrance', label: 'Fragrance' },
  { id: 'pets', label: 'Pets' },
  // Internal triggers
  { id: 'stress', label: 'Stress' },
  { id: 'poor_sleep', label: 'Poor Sleep' },
  { id: 'hormonal_changes', label: 'Hormonal Changes (Period / Cycle)' },
  { id: 'illness_infection', label: 'Illness / Infection' },
  // Activity & consumption
  { id: 'exercise', label: 'Exercise' },
  { id: 'alcohol', label: 'Alcohol' },
  { id: 'spicy_food', label: 'Spicy Food' },
  
  { id: 'friction_scratching', label: 'Friction / Scratching' },
];

interface TriggerPatternsInsightsProps {
  checkIns: CheckIn[];
  baselineConfidence: BaselineConfidence;
}

type TrendType = 'improving' | 'worsening' | 'stable';
type TimePeriod = 'week' | 'month' | 'all';

interface TriggerStat {
  id: string;
  label: string;
  uniqueDays: number;
  percentWorse: number;
  impactScore: number;
  isHighConfidence: boolean;
  trend: TrendType;
  recentImpact: number;
  historicalImpact: number;
}

interface ResolvedTrigger {
  id: string;
  label: string;
  totalDays: number;
  wasPercentWorse: number;
  nowPercentBetter: number;
}

interface ItemBreakdown {
  name: string;
  count: number;
  avgIntensity: number;
  percentWorse: number;
}

const TREND_THRESHOLD = 0.3;
const IMPACT_THRESHOLD = 0.3;

const PERIOD_DAYS: Record<TimePeriod, number> = {
  week: 7,
  month: 30,
  all: 9999,
};

const TRIGGERS_INITIAL_DISPLAY = 5;

const TriggerPatternsInsights = ({ checkIns, baselineConfidence }: TriggerPatternsInsightsProps) => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [showAllTriggers, setShowAllTriggers] = useState(false);
  const [showFoodBreakdown, setShowFoodBreakdown] = useState(false);
  const [showProductBreakdown, setShowProductBreakdown] = useState(false);
  const { activePatterns, resolvedTriggers, productBreakdown } = useMemo(() => {
    // Filter check-ins by selected time period
    const now = new Date();
    const periodDays = PERIOD_DAYS[timePeriod];
    const periodCutoff = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const filteredCheckIns = timePeriod === 'all' 
      ? checkIns 
      : checkIns.filter(c => new Date(c.timestamp) >= periodCutoff);
    
    const checkInsWithTriggers = filteredCheckIns.filter(c => c.triggers && c.triggers.length > 0);
    
    if (checkInsWithTriggers.length === 0) {
      return { activePatterns: [], resolvedTriggers: [] };
    }

    // Split check-ins into recent (last 14 days within period) and historical
    const recentDays = Math.min(14, periodDays / 2);
    const recentCutoff = new Date(now.getTime() - recentDays * 24 * 60 * 60 * 1000);
    
    const recentCheckIns = filteredCheckIns.filter(c => new Date(c.timestamp) >= recentCutoff);
    const historicalCheckIns = filteredCheckIns.filter(c => new Date(c.timestamp) < recentCutoff);
    
    // Calculate baselines for each period
    const allIntensities = checkIns.map(c => c.skinIntensity ?? (5 - c.skinFeeling));
    const overallBaseline = allIntensities.reduce((a, b) => a + b, 0) / allIntensities.length;
    
    const recentIntensities = recentCheckIns.map(c => c.skinIntensity ?? (5 - c.skinFeeling));
    const recentBaseline = recentIntensities.length > 0 
      ? recentIntensities.reduce((a, b) => a + b, 0) / recentIntensities.length 
      : overallBaseline;
    
    const historicalIntensities = historicalCheckIns.map(c => c.skinIntensity ?? (5 - c.skinFeeling));
    const historicalBaseline = historicalIntensities.length > 0 
      ? historicalIntensities.reduce((a, b) => a + b, 0) / historicalIntensities.length 
      : overallBaseline;

    // Build comprehensive stats for each trigger
    const stats: Record<string, { 
      uniqueDays: Set<string>;
      totalIntensity: number;
      totalCount: number;
      recentDays: Set<string>;
      recentIntensity: number;
      recentCount: number;
      historicalDays: Set<string>;
      historicalIntensity: number;
      historicalCount: number;
    }> = {};

    checkInsWithTriggers.forEach(checkIn => {
      const date = checkIn.timestamp.split('T')[0];
      const triggers = checkIn.triggers || [];
      const intensity = checkIn.skinIntensity ?? (5 - checkIn.skinFeeling);
      const isRecent = new Date(checkIn.timestamp) >= recentCutoff;

      triggers.forEach(triggerId => {
        // Skip food and product entries - they have their own dedicated sections
        if (triggerId.startsWith('food:') || 
            triggerId.startsWith('product:') || 
            triggerId.startsWith('new_product:') ||
            triggerId === 'new_product' ||
            triggerId === 'food' ||
            triggerId === 'specific_food') {
          return;
        }
        
        if (!stats[triggerId]) {
          stats[triggerId] = {
            uniqueDays: new Set(),
            totalIntensity: 0,
            totalCount: 0,
            recentDays: new Set(),
            recentIntensity: 0,
            recentCount: 0,
            historicalDays: new Set(),
            historicalIntensity: 0,
            historicalCount: 0,
          };
        }
        
        stats[triggerId].uniqueDays.add(date);
        stats[triggerId].totalCount++;
        stats[triggerId].totalIntensity += intensity;
        
        if (isRecent) {
          stats[triggerId].recentDays.add(date);
          stats[triggerId].recentCount++;
          stats[triggerId].recentIntensity += intensity;
        } else {
          stats[triggerId].historicalDays.add(date);
          stats[triggerId].historicalCount++;
          stats[triggerId].historicalIntensity += intensity;
        }
      });
    });

    const activePatterns: TriggerStat[] = [];
    const resolvedTriggers: ResolvedTrigger[] = [];

    // Helper to generate label for triggers (food and products are handled separately)
    const getLabel = (triggerId: string): string => {
      return triggersList.find(t => t.id === triggerId)?.label || triggerId;
    };

    Object.entries(stats).forEach(([id, data]) => {
      const uniqueDayCount = data.uniqueDays.size;
      const triggerDayIntensity = data.totalIntensity / data.totalCount;
      const impactDelta = triggerDayIntensity - overallBaseline;
      const label = getLabel(id);
      
      // Calculate period-specific impacts
      const recentImpact = data.recentCount > 0 
        ? (data.recentIntensity / data.recentCount) - recentBaseline 
        : 0;
      const historicalImpact = data.historicalCount > 0 
        ? (data.historicalIntensity / data.historicalCount) - historicalBaseline 
        : 0;
      
      // Determine trend (only if we have data in both periods)
      let trend: TrendType = 'stable';
      const hasRecentData = data.recentDays.size >= 2;
      const hasHistoricalData = data.historicalDays.size >= 2;
      
      if (hasRecentData && hasHistoricalData) {
        const trendDelta = recentImpact - historicalImpact;
        if (trendDelta < -TREND_THRESHOLD) {
          trend = 'improving';
        } else if (trendDelta > TREND_THRESHOLD) {
          trend = 'worsening';
        }
      }

      // Check if this was a previous pattern that's now resolved
      const wasPattern = data.historicalDays.size >= 3 && historicalImpact > IMPACT_THRESHOLD;
      const isCurrentlyPattern = uniqueDayCount >= 3 && impactDelta > IMPACT_THRESHOLD;
      const recentlyImproved = hasRecentData && recentImpact <= 0;

      if (wasPattern && !isCurrentlyPattern && recentlyImproved) {
        // This trigger has graduated out of concern
        resolvedTriggers.push({
          id,
          label,
          totalDays: uniqueDayCount,
          wasPercentWorse: Math.round((historicalImpact / Math.max(historicalBaseline, 0.5)) * 100),
          nowPercentBetter: Math.round(Math.abs(recentImpact / Math.max(recentBaseline, 0.5)) * 100),
        });
      } else if (isCurrentlyPattern) {
        // Still an active pattern
        const impactScore = impactDelta * 25;
        const percentWorse = Math.round((impactDelta / Math.max(overallBaseline, 0.5)) * 100);
        const isHighConfidence = uniqueDayCount >= 7 && impactDelta > 0.5;
        
        activePatterns.push({
          id,
          label,
          uniqueDays: uniqueDayCount,
          percentWorse,
          impactScore: Math.round(impactScore * 10) / 10,
          isHighConfidence,
          trend,
          recentImpact,
          historicalImpact,
        });
      }
    });

    // Sort active patterns by impact score (no artificial limit - we'll handle display in UI)
    activePatterns.sort((a, b) => b.impactScore - a.impactScore);
    
    // Extract product breakdown (keep old logic for products)
    const allIntensitiesForBaseline = checkIns.map(c => c.skinIntensity ?? (5 - c.skinFeeling));
    const baselineIntensity = allIntensitiesForBaseline.length > 0 
      ? allIntensitiesForBaseline.reduce((a, b) => a + b, 0) / allIntensitiesForBaseline.length 
      : 2;
    
    const productItems: Record<string, { count: number; totalIntensity: number }> = {};
    
    checkInsWithTriggers.forEach(checkIn => {
      const triggers = checkIn.triggers || [];
      const intensity = checkIn.skinIntensity ?? (5 - checkIn.skinFeeling);
      
      triggers.forEach(trigger => {
        if (trigger.startsWith('new_product:')) {
          const productName = trigger.slice(12).trim().toLowerCase();
          if (productName) {
            if (!productItems[productName]) {
              productItems[productName] = { count: 0, totalIntensity: 0 };
            }
            productItems[productName].count++;
            productItems[productName].totalIntensity += intensity;
          }
        }
      });
    });
    
    const productBreakdown: ItemBreakdown[] = Object.entries(productItems)
      .map(([name, data]) => {
        const avgIntensity = data.totalIntensity / data.count;
        const percentWorse = Math.round(((avgIntensity - baselineIntensity) / Math.max(baselineIntensity, 0.5)) * 100);
        return {
          name: name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
          count: data.count,
          avgIntensity,
          percentWorse,
        };
      })
      .sort((a, b) => b.percentWorse - a.percentWorse);
    
    return { 
      activePatterns, 
      resolvedTriggers: resolvedTriggers.slice(0, 3),
      productBreakdown,
    };
  }, [checkIns, timePeriod]);

  // New food analysis using delayed reaction logic
  const foodAnalysis = useMemo(() => {
    const periodDays = PERIOD_DAYS[timePeriod];
    return analyzeFoodReactions(checkIns, periodDays);
  }, [checkIns, timePeriod]);
  
  // New product analysis using delayed reaction logic
  const productAnalysis = useMemo(() => {
    const periodDays = PERIOD_DAYS[timePeriod];
    return analyzeProductReactions(checkIns, periodDays);
  }, [checkIns, timePeriod]);
  
  // Separate foods with sufficient data from those without
  const { analyzedFoods, insufficientDataFoods } = useMemo(() => {
    const analyzed = foodAnalysis.filter(f => f.pattern !== 'insufficient_data');
    const insufficient = foodAnalysis.filter(f => f.pattern === 'insufficient_data');
    return { analyzedFoods: analyzed, insufficientDataFoods: insufficient };
  }, [foodAnalysis]);
  
  // Separate products with sufficient data from those without
  const { analyzedProducts, insufficientDataProducts } = useMemo(() => {
    const analyzed = productAnalysis.filter(p => p.pattern !== 'insufficient_data');
    const insufficient = productAnalysis.filter(p => p.pattern === 'insufficient_data');
    return { analyzedProducts: analyzed, insufficientDataProducts: insufficient };
  }, [productAnalysis]);

  // Check if user has logged any triggers at all
  const hasAnyTriggers = checkIns.some(c => c.triggers && c.triggers.length > 0);

  const TimePeriodToggle = () => (
    <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
      {(['week', 'month', 'all'] as TimePeriod[]).map((period) => (
        <button
          key={period}
          onClick={() => setTimePeriod(period)}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-md transition-all",
            timePeriod === period 
              ? "bg-background text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {period === 'week' ? '7d' : period === 'month' ? '30d' : 'All'}
        </button>
      ))}
    </div>
  );

  // Show insufficient data message if user has triggers but none meet criteria
  if (hasAnyTriggers && activePatterns.length === 0 && resolvedTriggers.length === 0) {
    return (
      <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.25s' }}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 shadow-sm">
              <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            Patterns We're Watching
          </h3>
          <TimePeriodToggle />
        </div>
        <div className="glass-card p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-amber-500/15 to-amber-500/5 flex items-center justify-center">
            <Eye className="w-5 h-5 text-amber-500/60" />
          </div>
          <p className="text-sm text-muted-foreground">
            Not enough data {timePeriod !== 'all' ? `in the last ${timePeriod === 'week' ? '7' : '30'} days` : ''} to identify clear trigger patterns.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-2">
            {timePeriod !== 'all' ? 'Try viewing "All" time or ' : ''}Patterns become clearer as more days are logged.
          </p>
        </div>
      </div>
    );
  }

  // Show empty state if no trigger data at all
  if (activePatterns.length === 0 && resolvedTriggers.length === 0) {
    return (
      <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.25s' }}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 shadow-sm">
              <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            Patterns We're Watching
          </h3>
          <TimePeriodToggle />
        </div>
        <div className="glass-card p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-amber-500/15 to-amber-500/5 flex items-center justify-center">
            <Eye className="w-5 h-5 text-amber-500/60" />
          </div>
          <p className="text-sm text-muted-foreground">
            Start logging triggers in your daily check-ins to discover patterns over time.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-2">
            Patterns become clearer as more days are logged.
          </p>
        </div>
      </div>
    );
  }

  const maxImpact = Math.max(...activePatterns.map(t => t.impactScore), 1);

  const TrendIndicator = ({ trend }: { trend: TrendType }) => {
    if (trend === 'improving') {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded-full">
          <TrendingDown className="w-3 h-3" />
          Improving
        </span>
      );
    }
    if (trend === 'worsening') {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 px-1.5 py-0.5 rounded-full">
          <TrendingUp className="w-3 h-3" />
          Worsening
        </span>
      );
    }
    return null;
  };

  // Food Analysis Card Component
  const FoodAnalysisCard = ({ food, index }: { food: FoodAnalysisResult; index: number }) => {
    const getPatternStyles = (pattern: FoodPattern) => {
      switch (pattern) {
        case 'often_worse':
          return {
            bg: 'bg-amber-50 dark:bg-amber-950/30',
            border: 'border-amber-200/50 dark:border-amber-800/30',
            text: 'text-amber-700 dark:text-amber-300',
            label: 'Often followed by worse symptoms',
          };
        case 'often_better':
          return {
            bg: 'bg-emerald-50 dark:bg-emerald-950/30',
            border: 'border-emerald-200/50 dark:border-emerald-800/30',
            text: 'text-emerald-700 dark:text-emerald-300',
            label: 'Often followed by improvement',
          };
        case 'mixed':
          return {
            bg: 'bg-muted/50',
            border: 'border-muted',
            text: 'text-muted-foreground',
            label: 'Mixed reactions observed',
          };
        case 'no_pattern':
        default:
          return {
            bg: 'bg-muted/30',
            border: 'border-muted/50',
            text: 'text-muted-foreground/80',
            label: 'No clear pattern detected',
          };
      }
    };

    const getConfidenceBadge = (confidence: FoodConfidence) => {
      const getStyles = () => {
        switch (confidence) {
          case 'high':
            return {
              bg: 'bg-emerald-100 dark:bg-emerald-900/40',
              text: 'text-emerald-600 dark:text-emerald-400',
              label: 'High',
              tooltip: '8+ logs with consistent results',
            };
          case 'medium':
            return {
              bg: 'bg-blue-100 dark:bg-blue-900/40',
              text: 'text-blue-600 dark:text-blue-400',
              label: 'Moderate',
              tooltip: '5-7 logs with fairly consistent results',
            };
          case 'low':
          default:
            return {
              bg: 'bg-muted',
              text: 'text-muted-foreground',
              label: 'Preliminary',
              tooltip: 'Less than 5 logs — keep tracking for more accurate insights',
            };
        }
      };
      const styles = getStyles();
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full cursor-help",
              styles.bg,
              styles.text,
              confidence === 'low' && "opacity-70"
            )}>
              <Info className="w-2.5 h-2.5" />
              {styles.label} confidence
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px] text-xs">
            <p>{styles.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      );
    };

    const styles = getPatternStyles(food.pattern);
    const total = food.daysWorseAfter + food.daysBetterAfter + food.daysNeutralAfter;

    return (
      <div
        className={cn(
          "p-3.5 rounded-xl border shadow-sm animate-slide-up transition-all duration-200 hover:shadow-md",
          styles.bg,
          styles.border,
          food.confidence === 'low' && "opacity-80"
        )}
        style={{ animationDelay: `${index * 0.05}s` }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-sm">
              🍽️
            </div>
            <div>
              <span className="text-sm font-semibold text-foreground">{food.name}</span>
              <span className="text-xs text-muted-foreground ml-1.5">
                ({food.count})
              </span>
            </div>
          </div>
          {getConfidenceBadge(food.confidence)}
        </div>
        
        <p className={cn("text-xs font-medium mb-2", styles.text)}>
          {styles.label}
        </p>
        
        {food.analyzableExposures > 0 && (
          <div className="flex items-center gap-1.5 text-[10px]">
            {food.daysWorseAfter > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                {food.daysWorseAfter} worse
              </span>
            )}
            {food.daysBetterAfter > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                {food.daysBetterAfter} better
              </span>
            )}
            {food.daysNeutralAfter > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                {food.daysNeutralAfter} neutral
              </span>
            )}
            <span className="text-muted-foreground/60 ml-1">of {total}</span>
          </div>
        )}
      </div>
    );
  };

  // Product Analysis Card Component
  const ProductAnalysisCard = ({ product, index }: { product: ProductAnalysisResult; index: number }) => {
    const getPatternStyles = (pattern: ProductPattern) => {
      switch (pattern) {
        case 'often_worse':
          return { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200/50 dark:border-purple-800/30', text: 'text-purple-700 dark:text-purple-300', label: 'Often followed by worse symptoms' };
        case 'often_better':
          return { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200/50 dark:border-emerald-800/30', text: 'text-emerald-700 dark:text-emerald-300', label: 'Often followed by improvement' };
        case 'mixed':
          return { bg: 'bg-muted/50', border: 'border-muted', text: 'text-muted-foreground', label: 'Mixed reactions observed' };
        default:
          return { bg: 'bg-muted/30', border: 'border-muted/50', text: 'text-muted-foreground/80', label: 'No clear pattern detected' };
      }
    };

    const getConfidenceBadge = (confidence: ProductConfidence) => {
      const getStyles = () => {
        switch (confidence) {
          case 'high':
            return {
              bg: 'bg-emerald-100 dark:bg-emerald-900/40',
              text: 'text-emerald-600 dark:text-emerald-400',
              label: 'High',
              tooltip: '8+ logs with consistent results',
            };
          case 'medium':
            return {
              bg: 'bg-blue-100 dark:bg-blue-900/40',
              text: 'text-blue-600 dark:text-blue-400',
              label: 'Moderate',
              tooltip: '5-7 logs with fairly consistent results',
            };
          case 'low':
          default:
            return {
              bg: 'bg-muted',
              text: 'text-muted-foreground',
              label: 'Preliminary',
              tooltip: 'Less than 5 logs — keep tracking for more accurate insights',
            };
        }
      };
      const styles = getStyles();
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full cursor-help",
              styles.bg,
              styles.text,
              confidence === 'low' && "opacity-70"
            )}>
              <Info className="w-2.5 h-2.5" />
              {styles.label} confidence
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px] text-xs">
            <p>{styles.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      );
    };

    const styles = getPatternStyles(product.pattern);
    const total = product.daysWorseAfter + product.daysBetterAfter + product.daysNeutralAfter;

    return (
      <div 
        className={cn(
          "p-3.5 rounded-xl border shadow-sm animate-slide-up transition-all duration-200 hover:shadow-md", 
          styles.bg, 
          styles.border, 
          product.confidence === 'low' && "opacity-80"
        )} 
        style={{ animationDelay: `${index * 0.05}s` }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center text-sm">
              🧴
            </div>
            <div>
              <span className="text-sm font-semibold text-foreground">{product.name}</span>
              <span className="text-xs text-muted-foreground ml-1.5">({product.count})</span>
            </div>
          </div>
          {getConfidenceBadge(product.confidence)}
        </div>
        <p className={cn("text-xs font-medium mb-2", styles.text)}>{styles.label}</p>
        {product.analyzableExposures > 0 && (
          <div className="flex items-center gap-1.5 text-[10px]">
            {product.daysWorseAfter > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium">
                {product.daysWorseAfter} worse
              </span>
            )}
            {product.daysBetterAfter > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                {product.daysBetterAfter} better
              </span>
            )}
            {product.daysNeutralAfter > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                {product.daysNeutralAfter} neutral
              </span>
            )}
            <span className="text-muted-foreground/60 ml-1">of {total}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.25s' }}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 shadow-sm">
            <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          Patterns We're Watching
        </h3>
        <TimePeriodToggle />
      </div>
      
      {/* Active Patterns */}
      {activePatterns.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <p className="text-xs text-muted-foreground mb-1">
            Triggers correlated with worse-than-average skin days
          </p>
          {(showAllTriggers ? activePatterns : activePatterns.slice(0, TRIGGERS_INITIAL_DISPLAY)).map(({ id, label, uniqueDays, percentWorse, impactScore, isHighConfidence, trend }, index) => {
            const barWidth = (impactScore / maxImpact) * 100;
            
            return (
              <div 
                key={id} 
                className={cn(
                  "p-3 rounded-xl transition-all duration-200 animate-slide-up",
                  isHighConfidence 
                    ? "bg-gradient-to-r from-amber-500/10 to-transparent" 
                    : "bg-muted/30"
                )}
                style={{ animationDelay: `${0.3 + index * 0.03}s` }}
              >
                <div className="flex justify-between items-center gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn(
                      "font-semibold truncate",
                      isHighConfidence ? "text-amber-700 dark:text-amber-400" : "text-foreground"
                    )}>
                      {label}
                    </span>
                    <TrendIndicator trend={trend} />
                  </div>
                  <div className="text-right whitespace-nowrap">
                    {isHighConfidence ? (
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{percentWorse}%</span>
                    ) : (
                      <span className="text-xs text-muted-foreground font-medium">Early</span>
                    )}
                    <span className="text-xs text-muted-foreground/60 ml-1">({uniqueDays}d)</span>
                  </div>
                </div>
                <div className="h-2.5 bg-muted/60 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-700 ease-out",
                      isHighConfidence 
                        ? "bg-gradient-to-r from-amber-500 via-amber-400 to-orange-400" 
                        : "bg-gradient-to-r from-muted-foreground/40 to-muted-foreground/25"
                    )}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
          
          {activePatterns.length > TRIGGERS_INITIAL_DISPLAY && (
            <button
              onClick={() => setShowAllTriggers(!showAllTriggers)}
              className="flex items-center justify-center gap-1.5 w-full py-2.5 mt-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-500/5 rounded-lg transition-all duration-150"
            >
              {showAllTriggers ? (
                <>
                  Show less
                  <ChevronDown className="w-3.5 h-3.5 rotate-180 transition-transform" />
                </>
              ) : (
                <>
                  Show {activePatterns.length - TRIGGERS_INITIAL_DISPLAY} more
                  <ChevronDown className="w-3.5 h-3.5 transition-transform" />
                </>
              )}
            </button>
          )}
          <p className="text-[10px] text-muted-foreground/70 mt-3 pt-3 border-t border-border/30">
            Based on repeated check-ins over time. Early data may be inconclusive.
          </p>
        </div>
      )}

      {/* No Longer a Concern Section - Moved up, before Food/Product Diary */}
      {resolvedTriggers.length > 0 && (
        <div className="glass-card p-5 space-y-3 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/30">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              No Longer a Concern
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            These triggers were previously flagged but recent data shows improvement
          </p>
          <div className="space-y-2">
            {resolvedTriggers.map(({ id, label, totalDays, wasPercentWorse, nowPercentBetter }) => (
              <div 
                key={id} 
                className="flex items-center justify-between py-2 border-b border-emerald-200/30 dark:border-emerald-800/20 last:border-0"
              >
                <span className="font-medium text-sm text-foreground">
                  {label}
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  Was {wasPercentWorse}% worse → Now {nowPercentBetter > 0 ? `${nowPercentBetter}% better` : 'normal'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Food Diary Analysis Section - Always show, with empty state if needed */}
      <div className="glass-card p-5 space-y-3 overflow-hidden">
        <button
          onClick={() => setShowFoodBreakdown(!showFoodBreakdown)}
          className="flex items-center justify-between w-full group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/25 to-amber-500/10 shadow-sm group-hover:shadow-md transition-shadow">
              <UtensilsCrossed className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">
                Food Diary Analysis
              </p>
              <p className="text-xs text-muted-foreground">
                {foodAnalysis.length > 0 
                  ? `${foodAnalysis.length} food${foodAnalysis.length !== 1 ? 's' : ''} tracked`
                  : 'No foods logged yet'
                }
              </p>
            </div>
          </div>
          <ChevronDown className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            showFoodBreakdown && "rotate-180"
          )} />
        </button>
        
        {showFoodBreakdown && (
          <div className="space-y-3 pt-3 border-t border-border/30">
            {foodAnalysis.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-amber-500/15 to-amber-500/5 flex items-center justify-center">
                  <UtensilsCrossed className="w-5 h-5 text-amber-500/50" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  No food diary entries yet
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Log foods in your daily check-ins to discover patterns over time.
                </p>
              </div>
            ) : (
              <>
                {/* Disclaimer */}
                <div className="flex items-start gap-2.5 p-3 bg-gradient-to-r from-amber-50/80 to-transparent dark:from-amber-950/30 dark:to-transparent rounded-xl border border-amber-200/40 dark:border-amber-800/30">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                    Observations only — not medical advice. Correlation does not mean causation.
                  </p>
                </div>
                
                {/* Analyzed foods with patterns */}
                {analyzedFoods.length > 0 && (
                  <div className="space-y-2.5">
                    {analyzedFoods.map((food, index) => (
                      <FoodAnalysisCard key={food.name} food={food} index={index} />
                    ))}
                  </div>
                )}
                
                {/* Insufficient data foods */}
                {insufficientDataFoods.length > 0 && (
                  <div className="pt-3 border-t border-border/30">
                    <p className="text-xs text-muted-foreground mb-2.5 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                      Not enough data yet
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {insufficientDataFoods.map((food) => (
                        <span
                          key={food.name}
                          className="text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border/50"
                        >
                          {food.name} <span className="text-muted-foreground/60">({food.count})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Footer explanation */}
                <div className="flex items-start gap-2 pt-3 border-t border-border/30">
                  <Info className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                    Patterns based on symptoms 1-3 days after eating. Consult a healthcare provider before making dietary changes.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Product Diary Analysis Section - Always show, with empty state if needed */}
      <div className="glass-card p-5 space-y-3 overflow-hidden">
        <button
          onClick={() => setShowProductBreakdown(!showProductBreakdown)}
          className="flex items-center justify-between w-full group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/25 to-purple-500/10 shadow-sm group-hover:shadow-md transition-shadow">
              <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">
                Product Diary Analysis
              </p>
              <p className="text-xs text-muted-foreground">
                {productAnalysis.length > 0 
                  ? `${productAnalysis.length} product${productAnalysis.length !== 1 ? 's' : ''} tracked`
                  : 'No products logged yet'
                }
              </p>
            </div>
          </div>
          <ChevronDown className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            showProductBreakdown && "rotate-180"
          )} />
        </button>
        
        {showProductBreakdown && (
          <div className="space-y-3 pt-3 border-t border-border/30">
            {productAnalysis.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-500/15 to-purple-500/5 flex items-center justify-center">
                  <Package className="w-5 h-5 text-purple-500/50" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  No product diary entries yet
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Log products in your daily check-ins to discover patterns over time.
                </p>
              </div>
            ) : (
              <>
                {/* Disclaimer */}
                <div className="flex items-start gap-2.5 p-3 bg-gradient-to-r from-purple-50/80 to-transparent dark:from-purple-950/30 dark:to-transparent rounded-xl border border-purple-200/40 dark:border-purple-800/30">
                  <AlertCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-purple-700 dark:text-purple-300 leading-relaxed">
                    Observations only — not medical advice. Correlation does not mean causation.
                  </p>
                </div>
                
                {/* Analyzed products with patterns */}
                {analyzedProducts.length > 0 && (
                  <div className="space-y-2.5">
                    {analyzedProducts.map((product, index) => (
                      <ProductAnalysisCard key={product.name} product={product} index={index} />
                    ))}
                  </div>
                )}
                
                {/* Insufficient data products */}
                {insufficientDataProducts.length > 0 && (
                  <div className="pt-3 border-t border-border/30">
                    <p className="text-xs text-muted-foreground mb-2.5 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                      Not enough data yet
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {insufficientDataProducts.map((product) => (
                        <span
                          key={product.name}
                          className="text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border/50"
                        >
                          {product.name} <span className="text-muted-foreground/60">({product.count})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Footer explanation */}
                <div className="flex items-start gap-2 pt-3 border-t border-border/30">
                  <Info className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                    Patterns based on symptoms 1-3 days after use. Consult a dermatologist before making product changes.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TriggerPatternsInsights;
