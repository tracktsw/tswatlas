import { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { CheckIn } from '@/contexts/UserDataContext';
import { format, subDays, startOfDay, eachWeekOfInterval, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type TimeRange = '7' | '30' | 'all';

interface SymptomsInsightsProps {
  checkIns: CheckIn[];
}

const SymptomsInsights = ({ checkIns }: SymptomsInsightsProps) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('7');
  const [hiddenSymptoms, setHiddenSymptoms] = useState<Set<string>>(new Set());

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

  // Total check-ins count for context display
  const totalCheckInsInRange = filteredCheckIns.length;

  // Calculate symptom frequency - percentage is days symptom logged / days with any check-in
  const symptomStats = useMemo(() => {
    const symptomDays: Record<string, Set<string>> = {};
    
    // Count days each symptom was logged
    filteredCheckIns.forEach(checkIn => {
      const dateStr = format(new Date(checkIn.timestamp), 'yyyy-MM-dd');
      const symptoms = checkIn.symptomsExperienced || [];
      
      symptoms.forEach(symptom => {
        if (!symptomDays[symptom]) {
          symptomDays[symptom] = new Set();
        }
        symptomDays[symptom].add(dateStr);
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

  // Weekly trend data for chart (days per week). Only include weeks that have at least one check-in.
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

          symptoms.forEach((s) => {
            if (!daySymptoms[s]) daySymptoms[s] = new Set();
            daySymptoms[s].add(dateStr);
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

  // Get top symptoms for trend chart (max 4 for readability)
  const topSymptoms = useMemo(() => {
    return symptomStats.slice(0, 4).map(s => s.symptom);
  }, [symptomStats]);

  // Check if we have any symptom data
  const hasSymptomData = symptomStats.length > 0;

  // Weekly trend chart rules:
  // - Only show if we have at least 2 different weeks with data (weeks containing check-in days)
  // - Each bar represents number of days symptom appeared that week
  const hasEnoughDataForTrend = weeklyTrend.length >= 2 && topSymptoms.length > 0;

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
            {/* Symptom frequency list */}
            <div className="space-y-3">
              {symptomStats.map(({ symptom, count, percentage }, index) => (
                <div 
                  key={symptom} 
                  className="flex items-center justify-between animate-slide-up"
                  style={{ animationDelay: `${0.3 + index * 0.02}s` }}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2.5 h-2.5 rounded-full', symptomColors[symptom] || 'bg-gray-400')} />
                    <span className="text-sm font-medium text-foreground">{symptom}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {count} {count === 1 ? 'day' : 'days'} ({percentage}%)
                  </span>
                </div>
              ))}
            </div>

            {/* Weekly trend chart */}
            {hasEnoughDataForTrend ? (
              <div className="pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-3 font-medium">Weekly trend (days per week)</p>
                
                {/* Legend - tap to toggle */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {topSymptoms.map(symptom => {
                    const isHidden = hiddenSymptoms.has(symptom);
                    return (
                      <button
                        key={symptom}
                        onClick={() => toggleSymptomVisibility(symptom)}
                        className={cn(
                          'flex items-center gap-1 px-2 py-1 rounded-full transition-all duration-200',
                          isHidden 
                            ? 'opacity-40 bg-muted/30' 
                            : 'bg-muted/50 hover:bg-muted'
                        )}
                      >
                        <div className={cn(
                          'w-2 h-2 rounded-full transition-opacity',
                          symptomColors[symptom] || 'bg-gray-400',
                          isHidden && 'opacity-50'
                        )} />
                        <span className={cn(
                          'text-[10px]',
                          isHidden ? 'text-muted-foreground/50 line-through' : 'text-muted-foreground'
                        )}>
                          {symptom}
                        </span>
                      </button>
                    );
                  })}
                </div>
                
                {/* Chart */}
                <div className="flex items-end gap-1 h-20">
                  {weeklyTrend.map((week) => (
                    <div key={week.weekLabel} className="flex-1 flex flex-col items-center gap-0.5">
                      {/* Stacked bars for each symptom */}
                      <div className="w-full flex flex-col-reverse gap-0.5 h-16">
                        {topSymptoms.map(symptom => {
                          const count = week.counts[symptom] || 0;
                          const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                          const isHidden = hiddenSymptoms.has(symptom);
                          
                          return (
                            <div
                              key={symptom}
                              className={cn(
                                'w-full rounded-sm transition-all duration-300',
                                symptomColors[symptom] || 'bg-gray-400',
                                (count === 0 || isHidden) && 'opacity-0'
                              )}
                              style={{ 
                                height: isHidden ? '0%' : `${height}%`,
                                minHeight: count > 0 && !isHidden ? '4px' : '0px',
                              }}
                              title={`${symptom}: ${count} day${count !== 1 ? 's' : ''}`}
                            />
                          );
                        })}
                      </div>
                      <span className="text-[9px] text-muted-foreground mt-1 truncate w-full text-center">
                        {week.weekLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Not enough data for trend */
              <div className="pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground text-center py-2">
                  Not enough data yet to show weekly trends.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SymptomsInsights;
