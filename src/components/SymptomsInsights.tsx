import { useMemo, useState } from 'react';
import { Activity, Lock, ChevronDown, TrendingUp } from 'lucide-react';
import { CheckIn } from '@/contexts/UserDataContext';
import { format, subDays, startOfDay, eachWeekOfInterval, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { severityColors, severityLabels } from '@/constants/severityColors';

const INSIGHTS_UNLOCK_THRESHOLD = 30;

type TimeRange = '7' | '30' | 'all';

interface SymptomsInsightsProps {
  checkIns: CheckIn[];
}

const SymptomsInsights = ({ checkIns }: SymptomsInsightsProps) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('7');
  const [hiddenSymptoms, setHiddenSymptoms] = useState<Set<string>>(new Set());
  const [severityTrendOpen, setSeverityTrendOpen] = useState(false);

  const toggleSymptomVisibility = (symptom: string) => {
    setHiddenSymptoms(prev => {
      const next = new Set(prev);
      if (next.has(symptom)) {
        next.delete(symptom);
      } else {
        next.add(symptom);
      }
      return next;
    });
  };

  // Filter check-ins by time range
  const filteredCheckIns = useMemo(() => {
    if (timeRange === 'all') return checkIns;
    
    const now = startOfDay(new Date());
    const daysBack = timeRange === '7' ? 6 : 29;
    const startDate = subDays(now, daysBack);
    
    return checkIns.filter(c => {
      const checkInDate = new Date(c.timestamp);
      return checkInDate >= startDate;
    });
  }, [checkIns, timeRange]);

  // Get unique days with at least one check-in in the range
  const daysWithCheckIns = useMemo(() => {
    const uniqueDays = new Set<string>();
    filteredCheckIns.forEach(c => {
      uniqueDays.add(format(new Date(c.timestamp), 'yyyy-MM-dd'));
    });
    return uniqueDays.size;
  }, [filteredCheckIns]);

  // Total unique days across ALL check-ins (for gating threshold)
  const totalUniqueDaysLogged = useMemo(() => {
    const uniqueDays = new Set<string>();
    checkIns.forEach(c => {
      uniqueDays.add(format(new Date(c.timestamp), 'yyyy-MM-dd'));
    });
    return uniqueDays.size;
  }, [checkIns]);

  // Check if insights are unlocked (30+ unique days logged)
  const insightsUnlocked = totalUniqueDaysLogged >= INSIGHTS_UNLOCK_THRESHOLD;

  // Total check-ins count for context display
  const totalCheckInsInRange = filteredCheckIns.length;

  // Calculate symptom frequency - percentage is days symptom logged / days with any check-in
  const symptomStats = useMemo(() => {
    const symptomDays: Record<string, Set<string>> = {};
    
    // Count days each symptom was logged
    filteredCheckIns.forEach(checkIn => {
      const dateStr = format(new Date(checkIn.timestamp), 'yyyy-MM-dd');
      const symptoms = checkIn.symptomsExperienced || [];
      
      symptoms.forEach(entry => {
        const symptomName = entry.symptom;
        if (!symptomDays[symptomName]) {
          symptomDays[symptomName] = new Set();
        }
        symptomDays[symptomName].add(dateStr);
      });
    });
    
    // Convert to array and calculate percentages correctly
    // Percentage = (days symptom logged) / (days with at least one check-in) * 100
    return Object.entries(symptomDays)
      .map(([symptom, days]) => ({
        symptom,
        count: days.size,
        percentage: daysWithCheckIns > 0 ? Math.round((days.size / daysWithCheckIns) * 100) : 0,
      }))
      .filter(s => s.count > 0)
      // Sort by count descending, then alphabetically for ties
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.symptom.localeCompare(b.symptom);
      });
  }, [filteredCheckIns, daysWithCheckIns]);

  // Calculate average severity per symptom
  const symptomAvgSeverity = useMemo(() => {
    const severityTotals: Record<string, { sum: number; count: number }> = {};
    
    filteredCheckIns.forEach(checkIn => {
      (checkIn.symptomsExperienced || []).forEach(entry => {
        if (!severityTotals[entry.symptom]) {
          severityTotals[entry.symptom] = { sum: 0, count: 0 };
        }
        severityTotals[entry.symptom].sum += entry.severity || 2; // default to moderate if no severity
        severityTotals[entry.symptom].count += 1;
      });
    });
    
    return Object.fromEntries(
      Object.entries(severityTotals).map(([symptom, data]) => [
        symptom,
        data.count > 0 ? data.sum / data.count : 0
      ])
    );
  }, [filteredCheckIns]);

  // Weekly average severity trend per symptom
  const weeklySeverityTrend = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    if (timeRange === 'all' && checkIns.length > 0) {
      const oldest = checkIns.reduce((min, c) => {
        const d = new Date(c.timestamp);
        return d < min ? d : min;
      }, new Date());
      startDate = startOfWeek(oldest, { weekStartsOn: 0 });
    } else {
      const daysBack = timeRange === '7' ? 6 : 29;
      startDate = startOfWeek(subDays(now, daysBack), { weekStartsOn: 0 });
    }

    const weeks = eachWeekOfInterval({ start: startDate, end: now }, { weekStartsOn: 0 });
    const recentWeeks = weeks.slice(-8);

    return recentWeeks
      .map((weekStart) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
        const weekCheckIns = filteredCheckIns.filter((c) => {
          const d = new Date(c.timestamp);
          return isWithinInterval(d, { start: weekStart, end: weekEnd });
        });

        if (weekCheckIns.length === 0) return null;

        // Calculate average severity per symptom this week
        const symptomSeverities: Record<string, { sum: number; count: number }> = {};

        weekCheckIns.forEach((c) => {
          const symptoms = c.symptomsExperienced || [];
          symptoms.forEach((entry) => {
            if (!symptomSeverities[entry.symptom]) {
              symptomSeverities[entry.symptom] = { sum: 0, count: 0 };
            }
            symptomSeverities[entry.symptom].sum += entry.severity || 2;
            symptomSeverities[entry.symptom].count += 1;
          });
        });

        const avgSeverities: Record<string, number> = {};
        Object.entries(symptomSeverities).forEach(([s, data]) => {
          avgSeverities[s] = data.count > 0 ? data.sum / data.count : 0;
        });

        return {
          weekLabel: format(weekStart, 'MMM d'),
          avgSeverities,
        };
      })
      .filter((w): w is NonNullable<typeof w> => Boolean(w));
  }, [filteredCheckIns, checkIns, timeRange]);


  const weeklyTrend = useMemo(() => {
    // Determine date range
    const now = new Date();
    let startDate: Date;

    if (timeRange === 'all' && checkIns.length > 0) {
      const oldest = checkIns.reduce((min, c) => {
        const d = new Date(c.timestamp);
        return d < min ? d : min;
      }, new Date());
      startDate = startOfWeek(oldest, { weekStartsOn: 0 });
    } else {
      const daysBack = timeRange === '7' ? 6 : 29;
      startDate = startOfWeek(subDays(now, daysBack), { weekStartsOn: 0 });
    }

    const weeks = eachWeekOfInterval({ start: startDate, end: now }, { weekStartsOn: 0 });

    // Limit to last 8 weeks for readability
    const recentWeeks = weeks.slice(-8);

    return recentWeeks
      .map((weekStart) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
        const weekCheckIns = filteredCheckIns.filter((c) => {
          const d = new Date(c.timestamp);
          return isWithinInterval(d, { start: weekStart, end: weekEnd });
        });

        const totalDaysWithCheckInsThisWeek = new Set(
          weekCheckIns.map((c) => format(new Date(c.timestamp), 'yyyy-MM-dd'))
        ).size;

        // Only include weeks that have at least one check-in day
        if (totalDaysWithCheckInsThisWeek === 0) return null;

        // Count unique days each symptom appeared during this week
        const daySymptoms: Record<string, Set<string>> = {};

        weekCheckIns.forEach((c) => {
          const dateStr = format(new Date(c.timestamp), 'yyyy-MM-dd');
          const symptoms = c.symptomsExperienced || [];

          symptoms.forEach((entry) => {
            const symptomName = entry.symptom;
            if (!daySymptoms[symptomName]) daySymptoms[symptomName] = new Set();
            daySymptoms[symptomName].add(dateStr);
          });
        });

        const symptomCounts: Record<string, number> = {};
        Object.entries(daySymptoms).forEach(([s, days]) => {
          symptomCounts[s] = days.size;
        });

        return {
          weekLabel: format(weekStart, 'MMM d'),
          counts: symptomCounts,
          totalDays: totalDaysWithCheckInsThisWeek,
        };
      })
      .filter((w): w is NonNullable<typeof w> => Boolean(w));
  }, [filteredCheckIns, checkIns, timeRange]);

  // Get all symptoms with data for trend chart (show all, not limited)
  const chartSymptoms = useMemo(() => {
    return symptomStats.map(s => s.symptom);
  }, [symptomStats]);

  // Check if we have any symptom data
  const hasSymptomData = symptomStats.length > 0;

  // Weekly trend chart rules:
  // - Only show if we have at least 2 different weeks with data (weeks containing check-in days)
  // - Each bar represents number of days symptom appeared that week
  const hasEnoughDataForTrend = weeklyTrend.length >= 2 && chartSymptoms.length > 0;

  // Max value for chart scaling
  const maxCount = useMemo(() => {
    if (weeklyTrend.length === 0) return 1;
    let max = 1;
    weeklyTrend.forEach(week => {
      Object.values(week.counts).forEach(count => {
        if (count > max) max = count;
      });
    });
    return max;
  }, [weeklyTrend]);

  // Colors for symptoms
  const symptomColors: Record<string, string> = {
    'Burning': 'bg-red-400',
    'Itching': 'bg-orange-400',
    'Thermodysregulation': 'bg-purple-400',
    'Flaking': 'bg-amber-400',
    'Oozing': 'bg-yellow-500',
    'Swelling': 'bg-pink-400',
    'Redness': 'bg-rose-400',
    'Insomnia': 'bg-indigo-400',
  };

  return (
    <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.25s' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/20">
            <Activity className="w-4 h-4 text-purple-500" />
          </div>
          Symptoms
        </h3>
      </div>
      
      <div className="glass-card p-5 space-y-4">
        {/* Time range selector */}
        <div className="flex gap-2">
          <Button
            variant={timeRange === '7' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 rounded-xl text-xs h-8"
            onClick={() => setTimeRange('7')}
          >
            Last 7 days
          </Button>
          <Button
            variant={timeRange === '30' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 rounded-xl text-xs h-8"
            onClick={() => setTimeRange('30')}
          >
            Last 30 days
          </Button>
          <Button
            variant={timeRange === 'all' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 rounded-xl text-xs h-8"
            onClick={() => setTimeRange('all')}
          >
            All time
          </Button>
        </div>
        
        {/* Check-in context */}
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">
            Based on {daysWithCheckIns} day{daysWithCheckIns !== 1 ? 's' : ''} with check-ins
          </p>
          <p className="text-xs text-muted-foreground">
            {totalCheckInsInRange} total check-in{totalCheckInsInRange !== 1 ? 's' : ''} logged
          </p>
        </div>

        {/* Helper text explaining percentages */}
        <p className="text-[11px] text-muted-foreground/70 italic">
          Percentages reflect how often a symptom appeared on days you logged a check-in.
        </p>

        {totalCheckInsInRange === 0 ? (
          /* Empty state - no check-ins in range */
          <div className="text-center py-6">
            <p className="text-muted-foreground font-medium">No check-ins in this period.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try selecting a different time range or log more check-ins.
            </p>
          </div>
        ) : !hasSymptomData ? (
          /* Empty state - check-ins exist but no symptoms logged */
          <div className="text-center py-6">
            <p className="text-muted-foreground font-medium">No symptom data yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start logging symptoms in your daily check-ins to see insights here.
            </p>
          </div>
        ) : (
          <>
            {/* Symptom frequency list with severity indicators */}
            <div className="space-y-3">
              {symptomStats.map(({ symptom, count, percentage }, index) => {
                const avgSev = symptomAvgSeverity[symptom] || 2;
                const roundedSev = Math.round(avgSev) as 1 | 2 | 3;
                return (
                  <div 
                    key={symptom} 
                    className="flex items-center justify-between animate-slide-up"
                    style={{ animationDelay: `${0.3 + index * 0.02}s` }}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2.5 h-2.5 rounded-full', symptomColors[symptom] || 'bg-gray-400')} />
                      <span className="text-sm font-medium text-foreground">{symptom}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {count} {count === 1 ? 'day' : 'days'} ({percentage}%)
                      </span>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                        severityColors.badge[roundedSev]
                      )}>
                        {severityLabels[roundedSev]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Weekly trend chart - gated behind 30 days threshold */}
            {!insightsUnlocked ? (
              /* Locked state - not enough data */
              <div className="pt-4 border-t border-border/50">
                <div className="text-center py-6 space-y-4">
                  <div className="flex justify-center">
                    <div className="p-3 rounded-full bg-muted/50">
                      <Lock className="w-6 h-6 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">Insights unlock after 30 days</p>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                      Insights are generated once we have enough data to show meaningful patterns.
                    </p>
                  </div>
                  <div className="space-y-2 max-w-xs mx-auto">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span className="font-medium">{totalUniqueDaysLogged} / {INSIGHTS_UNLOCK_THRESHOLD} days logged</span>
                    </div>
                    <Progress value={(totalUniqueDaysLogged / INSIGHTS_UNLOCK_THRESHOLD) * 100} className="h-2" />
                  </div>
                  <Button asChild variant="outline" size="sm" className="mt-2">
                    <Link to="/check-in">Log today's check-in</Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

export default SymptomsInsights;
