import { useMemo } from 'react';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { CheckIn } from '@/contexts/UserDataContext';
import { cn } from '@/lib/utils';

const triggersList = [
  { id: 'heat_sweat', label: 'Heat / sweat' },
  { id: 'shower_hard_water', label: 'Shower / hard water' },
  { id: 'detergent', label: 'Detergent' },
  { id: 'fragrance', label: 'Fragrance' },
  { id: 'stress', label: 'Stress' },
  { id: 'poor_sleep', label: 'Poor sleep' },
  { id: 'exercise', label: 'Exercise' },
  { id: 'alcohol', label: 'Alcohol' },
  { id: 'spicy_food', label: 'Spicy food' },
  { id: 'dust_pollen', label: 'Dust / pollen' },
  { id: 'new_product', label: 'New product' },
  { id: 'friction_scratching', label: 'Friction / scratching' },
  { id: 'illness_infection', label: 'Illness / infection' },
  { id: 'pets', label: 'Pets' },
  { id: 'cold_air', label: 'Cold air' },
  { id: 'food', label: 'Food' },
];

interface TriggerPatternsInsightsProps {
  checkIns: CheckIn[];
}

const TriggerPatternsInsights = ({ checkIns }: TriggerPatternsInsightsProps) => {
  const triggerStats = useMemo(() => {
    // Only consider check-ins that have triggers and symptoms
    const checkInsWithTriggers = checkIns.filter(c => c.triggers && c.triggers.length > 0);
    
    if (checkInsWithTriggers.length === 0) return [];

    // Build stats: for each trigger, calculate average symptom severity and skin feeling
    const stats: Record<string, { 
      count: number; 
      totalSymptomSeverity: number;
      totalSymptoms: number;
      badDays: number; // days with skin feeling <= 2
      avgSkinFeeling: number;
      totalSkinFeeling: number;
    }> = {};

    checkInsWithTriggers.forEach(checkIn => {
      const triggers = checkIn.triggers || [];
      const symptoms = checkIn.symptomsExperienced || [];
      const totalSeverity = symptoms.reduce((sum, s) => sum + s.severity, 0);
      const isBadDay = checkIn.skinFeeling <= 2;

      triggers.forEach(triggerId => {
        // Handle food:xxx format
        const normalizedId = triggerId.startsWith('food:') ? 'food' : triggerId;
        
        if (!stats[normalizedId]) {
          stats[normalizedId] = {
            count: 0,
            totalSymptomSeverity: 0,
            totalSymptoms: 0,
            badDays: 0,
            avgSkinFeeling: 0,
            totalSkinFeeling: 0,
          };
        }
        stats[normalizedId].count++;
        stats[normalizedId].totalSymptomSeverity += totalSeverity;
        stats[normalizedId].totalSymptoms += symptoms.length;
        stats[normalizedId].totalSkinFeeling += checkIn.skinFeeling;
        if (isBadDay) {
          stats[normalizedId].badDays++;
        }
      });
    });

    // Calculate impact score: higher = worse correlation with symptoms
    // Impact = (bad day rate * 100) + (avg symptom severity when present)
    return Object.entries(stats)
      .filter(([_, data]) => data.count >= 2) // Need at least 2 occurrences for meaningful data
      .map(([id, data]) => {
        const badDayRate = data.badDays / data.count;
        const avgSymptomSeverity = data.totalSymptoms > 0 
          ? data.totalSymptomSeverity / data.totalSymptoms 
          : 0;
        const avgSkinFeeling = data.totalSkinFeeling / data.count;
        
        // Impact score: weighted combination of bad day rate and avg symptom severity
        // Bad days (skin <= 2) are weighted heavily
        const impactScore = (badDayRate * 70) + (avgSymptomSeverity * 10) + ((5 - avgSkinFeeling) * 4);

        // Get label for trigger
        let label = triggersList.find(t => t.id === id)?.label || id;
        
        return {
          id,
          label,
          count: data.count,
          badDayRate: Math.round(badDayRate * 100),
          avgSkinFeeling: Math.round(avgSkinFeeling * 10) / 10,
          impactScore: Math.round(impactScore),
        };
      })
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, 6); // Show top 6 triggers
  }, [checkIns]);

  // Don't render if no trigger data
  if (triggerStats.length === 0) {
    return null;
  }

  const maxImpact = Math.max(...triggerStats.map(t => t.impactScore), 1);

  return (
    <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.25s' }}>
      <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-amber-500/20">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        </div>
        Trigger Patterns
      </h3>
      <div className="glass-card p-5 space-y-4">
        <p className="text-xs text-muted-foreground">
          Triggers most associated with worse symptom days
        </p>
        {triggerStats.map(({ id, label, count, badDayRate, impactScore }, index) => {
          const barWidth = (impactScore / maxImpact) * 100;
          const isHighImpact = badDayRate >= 50;
          
          return (
            <div 
              key={id} 
              className="space-y-2 animate-slide-up"
              style={{ animationDelay: `${0.3 + index * 0.03}s` }}
            >
              <div className="flex justify-between items-center">
                <span className={cn(
                  "font-semibold",
                  isHighImpact ? "text-amber-700 dark:text-amber-400" : "text-foreground"
                )}>
                  {label}
                  {isHighImpact && (
                    <TrendingDown className="w-3.5 h-3.5 inline ml-1.5 text-amber-600" />
                  )}
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  {badDayRate}% bad days ({count} times)
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    isHighImpact 
                      ? "bg-gradient-to-r from-amber-500 to-amber-400" 
                      : "bg-gradient-to-r from-amber-400/70 to-amber-300/70"
                  )}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
        <p className="text-[10px] text-muted-foreground/70 mt-3 pt-3 border-t border-muted/50">
          Based on days when trigger was logged. Higher bar = stronger correlation with worse skin days.
        </p>
      </div>
    </div>
  );
};

export default TriggerPatternsInsights;
