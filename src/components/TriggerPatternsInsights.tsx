import { useMemo } from 'react';
import { Eye } from 'lucide-react';
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
  { id: 'food', label: 'Food' },
  { id: 'friction_scratching', label: 'Friction / Scratching' },
];

interface TriggerPatternsInsightsProps {
  checkIns: CheckIn[];
  baselineConfidence: BaselineConfidence;
}

const TriggerPatternsInsights = ({ checkIns, baselineConfidence }: TriggerPatternsInsightsProps) => {
  const triggerStats = useMemo(() => {
    // Only consider check-ins that have triggers
    const checkInsWithTriggers = checkIns.filter(c => c.triggers && c.triggers.length > 0);
    
    if (checkInsWithTriggers.length === 0) return [];

    // Group check-ins by date to count unique days per trigger
    const checkInsByDate = new Map<string, CheckIn[]>();
    checkInsWithTriggers.forEach(checkIn => {
      const date = checkIn.timestamp.split('T')[0];
      if (!checkInsByDate.has(date)) {
        checkInsByDate.set(date, []);
      }
      checkInsByDate.get(date)!.push(checkIn);
    });

    // Build stats: for each trigger, calculate unique days and intensity metrics
    const stats: Record<string, { 
      uniqueDays: Set<string>;
      highIntensityDays: Set<string>;
      totalSymptomSeverity: number;
      totalSymptoms: number;
      totalIntensity: number;
      totalCount: number;
    }> = {};

    checkInsWithTriggers.forEach(checkIn => {
      const date = checkIn.timestamp.split('T')[0];
      const triggers = checkIn.triggers || [];
      const symptoms = checkIn.symptomsExperienced || [];
      const totalSeverity = symptoms.reduce((sum, s) => sum + s.severity, 0);
      
      // Use skin_intensity if available, otherwise convert from skinFeeling (1-5 → 4-0)
      const intensity = checkIn.skinIntensity ?? (5 - checkIn.skinFeeling);
      const isHighIntensityDay = intensity >= 3; // Active (3) or High-intensity (4)

      triggers.forEach(triggerId => {
        // Handle food:xxx format
        const normalizedId = triggerId.startsWith('food:') ? 'food' : triggerId;
        
        if (!stats[normalizedId]) {
          stats[normalizedId] = {
            uniqueDays: new Set(),
            highIntensityDays: new Set(),
            totalSymptomSeverity: 0,
            totalSymptoms: 0,
            totalIntensity: 0,
            totalCount: 0,
          };
        }
        
        stats[normalizedId].uniqueDays.add(date);
        stats[normalizedId].totalCount++;
        stats[normalizedId].totalSymptomSeverity += totalSeverity;
        stats[normalizedId].totalSymptoms += symptoms.length;
        stats[normalizedId].totalIntensity += intensity;
        
        if (isHighIntensityDay) {
          stats[normalizedId].highIntensityDays.add(date);
        }
      });
    });

    // Filter and calculate impact scores
    // Requirements: 5+ unique days AND non-zero high-intensity rate
    return Object.entries(stats)
      .filter(([_, data]) => {
        const uniqueDayCount = data.uniqueDays.size;
        const highIntensityRate = data.highIntensityDays.size / uniqueDayCount;
        return uniqueDayCount >= 5 && highIntensityRate > 0;
      })
      .map(([id, data]) => {
        const uniqueDayCount = data.uniqueDays.size;
        const highIntensityRate = data.highIntensityDays.size / uniqueDayCount;
        const avgSymptomSeverity = data.totalSymptoms > 0 
          ? data.totalSymptomSeverity / data.totalSymptoms 
          : 0;
        const avgIntensity = data.totalIntensity / data.totalCount;
        
        // Impact score: weighted combination of high intensity day rate and avg symptom severity
        const impactScore = (highIntensityRate * 70) + (avgSymptomSeverity * 10) + (avgIntensity * 4);

        // Get label for trigger
        let label = triggersList.find(t => t.id === id)?.label || id;
        
        // Determine confidence level for this specific trigger
        const isHighConfidence = uniqueDayCount >= 10 && highIntensityRate >= 0.4;
        
        return {
          id,
          label,
          uniqueDays: uniqueDayCount,
          highIntensityRate: Math.round(highIntensityRate * 100),
          avgIntensity: Math.round(avgIntensity * 10) / 10,
          impactScore: Math.round(impactScore),
          isHighConfidence,
        };
      })
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, 6); // Show top 6 triggers
  }, [checkIns]);

  // Don't show section at all if baseline confidence is 'early'
  if (baselineConfidence === 'early') {
    return null;
  }

  // Check if user has logged any triggers at all
  const hasAnyTriggers = checkIns.some(c => c.triggers && c.triggers.length > 0);

  // Show insufficient data message if user has triggers but none meet criteria
  if (hasAnyTriggers && triggerStats.length === 0) {
    return (
      <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.25s' }}>
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-muted">
            <Eye className="w-4 h-4 text-muted-foreground" />
          </div>
          Patterns We're Watching
        </h3>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">
            Not enough data yet to identify clear trigger patterns.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-2">
            Patterns become clearer as more days are logged.
          </p>
        </div>
      </div>
    );
  }

  // Show empty state if no trigger data at all
  if (triggerStats.length === 0) {
    return (
      <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.25s' }}>
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-muted">
            <Eye className="w-4 h-4 text-muted-foreground" />
          </div>
          Patterns We're Watching
        </h3>
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

  const maxImpact = Math.max(...triggerStats.map(t => t.impactScore), 1);

  return (
    <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.25s' }}>
      <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-muted">
          <Eye className="w-4 h-4 text-muted-foreground" />
        </div>
        Patterns We're Watching
      </h3>
      <div className="glass-card p-5 space-y-4">
        <p className="text-xs text-muted-foreground">
          Triggers associated with higher-intensity days
        </p>
        {triggerStats.map(({ id, label, uniqueDays, highIntensityRate, impactScore, isHighConfidence }, index) => {
          const barWidth = (impactScore / maxImpact) * 100;
          
          return (
            <div 
              key={id} 
              className="space-y-2 animate-slide-up"
              style={{ animationDelay: `${0.3 + index * 0.03}s` }}
            >
              <div className="flex justify-between items-center">
                <span className={cn(
                  "font-semibold",
                  isHighConfidence ? "text-amber-700 dark:text-amber-400" : "text-foreground"
                )}>
                  {label}
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  {isHighConfidence 
                    ? `${highIntensityRate}% high-intensity days`
                    : 'Early pattern'
                  }
                  <span className="text-muted-foreground/60 ml-1">({uniqueDays} days)</span>
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
        <p className="text-[10px] text-muted-foreground/70 mt-3 pt-3 border-t border-muted/50">
          Based on repeated check-ins over time. Early data may be inconclusive.
        </p>
      </div>
    </div>
  );
};

export default TriggerPatternsInsights;
