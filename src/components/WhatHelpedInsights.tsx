import { useMemo, useState } from 'react';
import { Lightbulb, TrendingUp, TrendingDown, Lock, ChevronDown, Sparkles, Moon, AlertTriangle } from 'lucide-react';
import { CheckIn } from '@/contexts/UserDataContext';
import { format, subDays, startOfDay, eachWeekOfInterval, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const INSIGHTS_UNLOCK_THRESHOLD = 30;

interface WhatHelpedInsightsProps {
  checkIns: CheckIn[];
}

interface ImprovementPeriod {
  startWeek: string;
  endWeek: string;
  skinImprovement: number;
  symptomImprovement: number;
}

interface CorrelationResult {
  id: string;
  label: string;
  type: 'treatment' | 'trigger_absent' | 'sleep';
  correlationRatio: number;
  improvementUsage: number;
  baselineUsage: number;
  confidence: 'low' | 'medium' | 'high';
}

const treatments = [
  { id: 'nmt', label: 'NMT' },
  { id: 'moisturizer', label: 'Moisturizer' },
  { id: 'rlt', label: 'Red Light' },
  { id: 'salt_bath', label: 'Salt Bath' },
  { id: 'cold_compress', label: 'Cold Compress' },
  { id: 'antihistamine', label: 'Antihistamine' },
  { id: 'exercise', label: 'Exercise' },
  { id: 'meditation', label: 'Meditation' },
];

const triggersList = [
  { id: 'stress', label: 'Stress' },
  { id: 'sweat', label: 'Sweat' },
  { id: 'heat', label: 'Heat' },
  { id: 'cold_weather', label: 'Cold Weather' },
  { id: 'food', label: 'Food' },
  { id: 'alcohol', label: 'Alcohol' },
  { id: 'poor_sleep', label: 'Poor Sleep' },
  { id: 'exercise_trigger', label: 'Exercise' },
];

const WhatHelpedInsights = ({ checkIns }: WhatHelpedInsightsProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Get total unique days logged for gating
  const totalUniqueDaysLogged = useMemo(() => {
    const uniqueDays = new Set<string>();
    checkIns.forEach(c => {
      uniqueDays.add(format(new Date(c.timestamp), 'yyyy-MM-dd'));
    });
    return uniqueDays.size;
  }, [checkIns]);

  const insightsUnlocked = totalUniqueDaysLogged >= INSIGHTS_UNLOCK_THRESHOLD;

  // Calculate weekly averages for skin feeling and symptom severity
  const weeklyData = useMemo(() => {
    if (checkIns.length === 0) return [];

    const oldest = checkIns.reduce((min, c) => {
      const d = new Date(c.timestamp);
      return d < min ? d : min;
    }, new Date());
    
    const weeks = eachWeekOfInterval(
      { start: startOfWeek(oldest, { weekStartsOn: 0 }), end: new Date() },
      { weekStartsOn: 0 }
    );

    return weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
      const weekCheckIns = checkIns.filter(c => {
        const d = new Date(c.timestamp);
        return isWithinInterval(d, { start: weekStart, end: weekEnd });
      });

      if (weekCheckIns.length === 0) return null;

      const avgSkin = weekCheckIns.reduce((sum, c) => sum + c.skinFeeling, 0) / weekCheckIns.length;
      
      // Calculate average symptom severity
      let totalSeverity = 0;
      let symptomCount = 0;
      weekCheckIns.forEach(c => {
        (c.symptomsExperienced || []).forEach(s => {
          totalSeverity += s.severity || 2;
          symptomCount++;
        });
      });
      const avgSymptomSeverity = symptomCount > 0 ? totalSeverity / symptomCount : 0;

      // Collect treatments used
      const treatmentsUsed = new Set<string>();
      weekCheckIns.forEach(c => (c.treatments || []).forEach(t => treatmentsUsed.add(t)));

      // Collect triggers logged
      const triggersLogged = new Set<string>();
      weekCheckIns.forEach(c => (c.triggers || []).forEach(t => triggersLogged.add(t)));

      // Average sleep
      const sleepScores = weekCheckIns.filter(c => c.sleepScore != null);
      const avgSleep = sleepScores.length > 0 
        ? sleepScores.reduce((sum, c) => sum + (c.sleepScore || 0), 0) / sleepScores.length
        : null;

      return {
        weekStart,
        weekLabel: format(weekStart, 'MMM d'),
        avgSkin,
        avgSymptomSeverity,
        treatmentsUsed,
        triggersLogged,
        avgSleep,
        checkInCount: weekCheckIns.length,
      };
    }).filter((w): w is NonNullable<typeof w> => w !== null);
  }, [checkIns]);

  // Find improvement periods (where skin improved by 0.5+ over 2+ consecutive weeks)
  const improvementPeriods = useMemo((): ImprovementPeriod[] => {
    if (weeklyData.length < 3) return [];

    const periods: ImprovementPeriod[] = [];
    
    for (let i = 2; i < weeklyData.length; i++) {
      const current = weeklyData[i];
      const previous = weeklyData[i - 2]; // Compare to 2 weeks ago
      
      const skinImprovement = current.avgSkin - previous.avgSkin;
      const symptomImprovement = previous.avgSymptomSeverity - current.avgSymptomSeverity;
      
      // Significant improvement: skin up by 0.5+ OR symptoms down by 0.3+
      if (skinImprovement >= 0.5 || symptomImprovement >= 0.3) {
        periods.push({
          startWeek: previous.weekLabel,
          endWeek: current.weekLabel,
          skinImprovement,
          symptomImprovement,
        });
      }
    }

    return periods;
  }, [weeklyData]);

  // Analyze what was different during improvement periods
  const correlationAnalysis = useMemo((): CorrelationResult[] => {
    if (improvementPeriods.length === 0 || weeklyData.length < 4) return [];

    const results: CorrelationResult[] = [];
    
    // Split weeks into improvement periods vs baseline
    const improvementWeeks = new Set<string>();
    improvementPeriods.forEach(period => {
      weeklyData.forEach(week => {
        if (week.weekLabel === period.endWeek || week.weekLabel === period.startWeek) {
          improvementWeeks.add(week.weekLabel);
        }
      });
    });

    const improvementWeekData = weeklyData.filter(w => improvementWeeks.has(w.weekLabel));
    const baselineWeekData = weeklyData.filter(w => !improvementWeeks.has(w.weekLabel));

    if (baselineWeekData.length === 0) return [];

    // Analyze treatments
    const allTreatments = new Set<string>();
    weeklyData.forEach(w => w.treatmentsUsed.forEach(t => allTreatments.add(t)));

    allTreatments.forEach(treatmentId => {
      const improvementUsage = improvementWeekData.filter(w => w.treatmentsUsed.has(treatmentId)).length / improvementWeekData.length;
      const baselineUsage = baselineWeekData.filter(w => w.treatmentsUsed.has(treatmentId)).length / baselineWeekData.length;

      if (baselineUsage > 0 && improvementUsage > 0.3) {
        const ratio = improvementUsage / baselineUsage;
        if (ratio > 1.3) {
          results.push({
            id: treatmentId,
            label: treatments.find(t => t.id === treatmentId)?.label || treatmentId,
            type: 'treatment',
            correlationRatio: ratio,
            improvementUsage,
            baselineUsage,
            confidence: improvementWeekData.length >= 4 ? 'high' : improvementWeekData.length >= 2 ? 'medium' : 'low',
          });
        }
      }
    });

    // Analyze triggers (absence during improvement)
    const allTriggers = new Set<string>();
    weeklyData.forEach(w => w.triggersLogged.forEach(t => allTriggers.add(t)));

    allTriggers.forEach(triggerId => {
      const improvementPresence = improvementWeekData.filter(w => w.triggersLogged.has(triggerId)).length / improvementWeekData.length;
      const baselinePresence = baselineWeekData.filter(w => w.triggersLogged.has(triggerId)).length / baselineWeekData.length;

      // Trigger was present in baseline but absent during improvement
      if (baselinePresence > 0.3 && improvementPresence < baselinePresence * 0.5) {
        const triggerLabel = triggerId.startsWith('food:') 
          ? `Food: ${triggerId.slice(5).charAt(0).toUpperCase() + triggerId.slice(6)}`
          : triggersList.find(t => t.id === triggerId)?.label || triggerId;

        results.push({
          id: triggerId,
          label: triggerLabel,
          type: 'trigger_absent',
          correlationRatio: baselinePresence / (improvementPresence + 0.01),
          improvementUsage: improvementPresence,
          baselineUsage: baselinePresence,
          confidence: baselineWeekData.length >= 4 ? 'high' : 'medium',
        });
      }
    });

    // Analyze sleep
    const improvementSleep = improvementWeekData.filter(w => w.avgSleep != null);
    const baselineSleep = baselineWeekData.filter(w => w.avgSleep != null);

    if (improvementSleep.length > 0 && baselineSleep.length > 0) {
      const avgImprovementSleep = improvementSleep.reduce((sum, w) => sum + (w.avgSleep || 0), 0) / improvementSleep.length;
      const avgBaselineSleep = baselineSleep.reduce((sum, w) => sum + (w.avgSleep || 0), 0) / baselineSleep.length;

      if (avgImprovementSleep > avgBaselineSleep + 0.5) {
        results.push({
          id: 'sleep',
          label: 'Better Sleep',
          type: 'sleep',
          correlationRatio: avgImprovementSleep / avgBaselineSleep,
          improvementUsage: avgImprovementSleep,
          baselineUsage: avgBaselineSleep,
          confidence: 'medium',
        });
      }
    }

    // Sort by correlation ratio
    return results.sort((a, b) => b.correlationRatio - a.correlationRatio);
  }, [improvementPeriods, weeklyData]);

  const helpfulFactors = correlationAnalysis.filter(c => c.type === 'treatment' || c.type === 'sleep');
  const triggersToAvoid = correlationAnalysis.filter(c => c.type === 'trigger_absent');

  if (checkIns.length === 0) return null;

  return (
    <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.35s' }}>
      <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-amber-500/20">
          <Lightbulb className="w-4 h-4 text-amber-500" />
        </div>
        What Helped
      </h3>

      <div className="glass-card p-5 space-y-4">
        {!insightsUnlocked ? (
          /* Locked state */
          <div className="text-center py-6 space-y-4">
            <div className="flex justify-center">
              <div className="p-3 rounded-full bg-muted/50">
                <Lock className="w-6 h-6 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">Correlation analysis unlocks after 30 days</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                We need more data to identify what's helping your skin improve.
              </p>
            </div>
            <div className="space-y-2 max-w-xs mx-auto">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span className="font-medium">{totalUniqueDaysLogged} / {INSIGHTS_UNLOCK_THRESHOLD} days</span>
              </div>
              <Progress value={(totalUniqueDaysLogged / INSIGHTS_UNLOCK_THRESHOLD) * 100} className="h-2" />
            </div>
          </div>
        ) : improvementPeriods.length === 0 ? (
          /* No improvement periods detected */
          <div className="text-center py-6 space-y-3">
            <div className="flex justify-center">
              <div className="p-3 rounded-full bg-muted/50">
                <TrendingUp className="w-6 h-6 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">No significant improvement periods detected yet</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                We're looking for weeks where your skin got noticeably better. Keep logging to help us find patterns!
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Improvement periods summary */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                We found <span className="font-semibold text-foreground">{improvementPeriods.length}</span> improvement period{improvementPeriods.length > 1 ? 's' : ''} in your data.
              </p>
              <div className="flex flex-wrap gap-2">
                {improvementPeriods.slice(0, 3).map((period, i) => (
                  <span 
                    key={i}
                    className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-600 font-medium"
                  >
                    {period.startWeek} → {period.endWeek}
                    {period.skinImprovement > 0 && (
                      <TrendingUp className="w-3 h-3 inline ml-1" />
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* Helpful factors */}
            {helpfulFactors.length > 0 && (
              <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between w-full py-2 px-3 rounded-lg bg-green-500/10 hover:bg-green-500/15 transition-colors">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-xs font-medium text-foreground">
                        {helpfulFactors.length} factor{helpfulFactors.length > 1 ? 's' : ''} correlated with improvement
                      </span>
                    </div>
                    <ChevronDown className={cn(
                      'w-4 h-4 text-muted-foreground transition-transform duration-200',
                      isOpen && 'rotate-180'
                    )} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  {helpfulFactors.map((factor, i) => (
                    <div key={factor.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {factor.type === 'sleep' ? (
                          <Moon className="w-4 h-4 text-indigo-500" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                        )}
                        <span className="text-sm font-medium">{factor.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-600 font-semibold">
                          {factor.correlationRatio.toFixed(1)}x more during improvement
                        </span>
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded-full',
                          factor.confidence === 'high' ? 'bg-green-500/20 text-green-600' :
                          factor.confidence === 'medium' ? 'bg-amber-500/20 text-amber-600' :
                          'bg-muted text-muted-foreground'
                        )}>
                          {factor.confidence}
                        </span>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Triggers to avoid */}
            {triggersToAvoid.length > 0 && (
              <div className="pt-3 border-t border-border/50 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-foreground">Triggers absent during improvement</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {triggersToAvoid.map(trigger => (
                    <span 
                      key={trigger.id}
                      className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 font-medium"
                    >
                      {trigger.label}
                      <TrendingDown className="w-3 h-3 inline ml-1" />
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  These triggers were logged less often when your skin was improving.
                </p>
              </div>
            )}

            {/* Summary */}
            {(helpfulFactors.length > 0 || triggersToAvoid.length > 0) && (
              <div className="pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground italic">
                  💡 Based on your data, 
                  {helpfulFactors.length > 0 && (
                    <> <span className="font-medium text-foreground">{helpfulFactors[0].label}</span></>
                  )}
                  {helpfulFactors.length > 0 && triggersToAvoid.length > 0 && ' combined with avoiding '}
                  {triggersToAvoid.length > 0 && (
                    <><span className="font-medium text-foreground">{triggersToAvoid[0].label}</span></>
                  )}
                  {' may have contributed to your improvement.'}
                </p>
              </div>
            )}

            {helpfulFactors.length === 0 && triggersToAvoid.length === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  We detected improvement periods but couldn't find strong correlations with specific treatments or triggers.
                  Keep logging consistently to help us find patterns!
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WhatHelpedInsights;
