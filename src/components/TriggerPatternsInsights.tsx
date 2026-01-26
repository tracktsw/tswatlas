import { useMemo, useState } from 'react';
import { Eye, TrendingDown, TrendingUp, CheckCircle2, ChevronDown, UtensilsCrossed, Package } from 'lucide-react';
import { CheckIn } from '@/contexts/UserDataContext';
import { cn } from '@/lib/utils';
import { BaselineConfidence } from '@/utils/flareStateEngine';

const triggersList = [
  // Environmental triggers
  { id: 'heat_sweat', label: 'Heat / Sweat' },
  { id: 'cold_air', label: 'Cold Air' },
  { id: 'weather_change', label: 'Weather Change' },
  { id: 'shower_hard_water', label: 'Shower / Hard Water' },
  { id: 'dust_pollen', label: 'Dust / Pollen' },
  { id: 'detergent', label: 'Detergent' },
  { id: 'fragrance', label: 'Fragrance' },
  { id: 'new_product', label: 'New Product' },
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
  { id: 'specific_food', label: 'Specific Food' },
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
  const { activePatterns, resolvedTriggers, foodBreakdown, productBreakdown } = useMemo(() => {
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
        // Normalize food triggers for consistent matching (e.g., "food:Nuts" -> "food:nuts")
        const normalizedId = triggerId.startsWith('food:') 
          ? `food:${triggerId.slice(5).toLowerCase().trim()}`
          : triggerId;
        
        if (!stats[normalizedId]) {
          stats[normalizedId] = {
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
        
        stats[normalizedId].uniqueDays.add(date);
        stats[normalizedId].totalCount++;
        stats[normalizedId].totalIntensity += intensity;
        
        if (isRecent) {
          stats[normalizedId].recentDays.add(date);
          stats[normalizedId].recentCount++;
          stats[normalizedId].recentIntensity += intensity;
        } else {
          stats[normalizedId].historicalDays.add(date);
          stats[normalizedId].historicalCount++;
          stats[normalizedId].historicalIntensity += intensity;
        }
      });
    });

    const activePatterns: TriggerStat[] = [];
    const resolvedTriggers: ResolvedTrigger[] = [];

    // Helper to generate label for triggers, including specific food items and new products
    const getLabel = (triggerId: string): string => {
      if (triggerId.startsWith('food:')) {
        const foodName = triggerId.slice(5).trim();
        if (!foodName) return 'Food (unspecified)';
        // Capitalize first letter of each word
        return `🍽️ ${foodName.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ')}`;
      }
      if (triggerId === 'food' || triggerId === 'specific_food') {
        return 'Food (unspecified)';
      }
      if (triggerId.startsWith('new_product:')) {
        const productName = triggerId.slice(12).trim();
        if (!productName) return 'New Product (unspecified)';
        // Capitalize first letter of each word
        return `🧴 ${productName.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ')}`;
      }
      if (triggerId === 'new_product') {
        return 'New Product (unspecified)';
      }
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
    
    // Extract food and product breakdown for dedicated sections
    const allIntensitiesForBaseline = checkIns.map(c => c.skinIntensity ?? (5 - c.skinFeeling));
    const baselineIntensity = allIntensitiesForBaseline.length > 0 
      ? allIntensitiesForBaseline.reduce((a, b) => a + b, 0) / allIntensitiesForBaseline.length 
      : 2;
    
    const foodItems: Record<string, { count: number; totalIntensity: number }> = {};
    const productItems: Record<string, { count: number; totalIntensity: number }> = {};
    
    checkInsWithTriggers.forEach(checkIn => {
      const triggers = checkIn.triggers || [];
      const intensity = checkIn.skinIntensity ?? (5 - checkIn.skinFeeling);
      
      triggers.forEach(trigger => {
        if (trigger.startsWith('food:')) {
          const foodName = trigger.slice(5).trim().toLowerCase();
          if (foodName) {
            if (!foodItems[foodName]) {
              foodItems[foodName] = { count: 0, totalIntensity: 0 };
            }
            foodItems[foodName].count++;
            foodItems[foodName].totalIntensity += intensity;
          }
        } else if (trigger.startsWith('new_product:')) {
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
    
    const foodBreakdown: ItemBreakdown[] = Object.entries(foodItems)
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
      foodBreakdown,
      productBreakdown,
    };
  }, [checkIns, timePeriod]);

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
            <div className="p-1.5 rounded-lg bg-muted">
              <Eye className="w-4 h-4 text-muted-foreground" />
            </div>
            Patterns We're Watching
          </h3>
          <TimePeriodToggle />
        </div>
        <div className="glass-card p-5">
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
            <div className="p-1.5 rounded-lg bg-muted">
              <Eye className="w-4 h-4 text-muted-foreground" />
            </div>
            Patterns We're Watching
          </h3>
          <TimePeriodToggle />
        </div>
        <div className="glass-card p-5">
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

  return (
    <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.25s' }}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-muted">
            <Eye className="w-4 h-4 text-muted-foreground" />
          </div>
          Patterns We're Watching
        </h3>
        <TimePeriodToggle />
      </div>
      
      {/* Active Patterns */}
      {activePatterns.length > 0 && (
        <div className="glass-card p-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            Triggers correlated with worse-than-average skin days
          </p>
          {(showAllTriggers ? activePatterns : activePatterns.slice(0, TRIGGERS_INITIAL_DISPLAY)).map(({ id, label, uniqueDays, percentWorse, impactScore, isHighConfidence, trend }, index) => {
            const barWidth = (impactScore / maxImpact) * 100;
            
            return (
              <div 
                key={id} 
                className="space-y-2 animate-slide-up"
                style={{ animationDelay: `${0.3 + index * 0.03}s` }}
              >
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn(
                      "font-semibold truncate",
                      isHighConfidence ? "text-amber-700 dark:text-amber-400" : "text-foreground"
                    )}>
                      {label}
                    </span>
                    <TrendIndicator trend={trend} />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                    {isHighConfidence 
                      ? `${percentWorse}% worse`
                      : 'Early pattern'
                    }
                    <span className="text-muted-foreground/60 ml-1">({uniqueDays}d)</span>
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      isHighConfidence 
                        ? "bg-gradient-to-r from-amber-500 to-amber-400" 
                        : "bg-gradient-to-r from-muted-foreground/40 to-muted-foreground/30"
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
              className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
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
          <p className="text-[10px] text-muted-foreground/70 mt-3 pt-3 border-t border-muted/50">
            Based on repeated check-ins over time. Early data may be inconclusive.
          </p>
        </div>
      )}

      {/* Food Breakdown Section */}
      {foodBreakdown.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <button
            onClick={() => setShowFoodBreakdown(!showFoodBreakdown)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <UtensilsCrossed className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">
                  Food Breakdown
                </p>
                <p className="text-xs text-muted-foreground">
                  {foodBreakdown.length} food{foodBreakdown.length !== 1 ? 's' : ''} tracked
                </p>
              </div>
            </div>
            <ChevronDown className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              showFoodBreakdown && "rotate-180"
            )} />
          </button>
          
          {showFoodBreakdown && (
            <div className="space-y-2 pt-2 border-t border-muted/50">
              {foodBreakdown.map((item, index) => (
                <div 
                  key={item.name}
                  className="flex items-center justify-between py-1.5"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <span className="text-sm font-medium text-foreground flex items-center gap-2">
                    🍽️ {item.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {item.count}×
                    </span>
                    <span className={cn(
                      "text-xs font-medium px-1.5 py-0.5 rounded-full",
                      item.percentWorse > 20 
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : item.percentWorse > 0
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    )}>
                      {item.percentWorse > 0 ? `+${item.percentWorse}%` : item.percentWorse === 0 ? 'neutral' : `${item.percentWorse}%`}
                    </span>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground/70 pt-2">
                Shows how skin intensity compared to your average on days with each food
              </p>
            </div>
          )}
        </div>
      )}

      {/* Product Breakdown Section */}
      {productBreakdown.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <button
            onClick={() => setShowProductBreakdown(!showProductBreakdown)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">
                  Product Breakdown
                </p>
                <p className="text-xs text-muted-foreground">
                  {productBreakdown.length} product{productBreakdown.length !== 1 ? 's' : ''} tracked
                </p>
              </div>
            </div>
            <ChevronDown className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              showProductBreakdown && "rotate-180"
            )} />
          </button>
          
          {showProductBreakdown && (
            <div className="space-y-2 pt-2 border-t border-muted/50">
              {productBreakdown.map((item, index) => (
                <div 
                  key={item.name}
                  className="flex items-center justify-between py-1.5"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <span className="text-sm font-medium text-foreground flex items-center gap-2">
                    🧴 {item.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {item.count}×
                    </span>
                    <span className={cn(
                      "text-xs font-medium px-1.5 py-0.5 rounded-full",
                      item.percentWorse > 20 
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : item.percentWorse > 0
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    )}>
                      {item.percentWorse > 0 ? `+${item.percentWorse}%` : item.percentWorse === 0 ? 'neutral' : `${item.percentWorse}%`}
                    </span>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground/70 pt-2">
                Shows how skin intensity compared to your average on days with each product
              </p>
            </div>
          )}
        </div>
      )}

      {/* No Longer a Concern Section */}
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
    </div>
  );
};

export default TriggerPatternsInsights;
