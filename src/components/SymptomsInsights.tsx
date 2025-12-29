import { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { CheckIn } from '@/contexts/UserDataContext';
import { format, subDays, startOfDay, eachWeekOfInterval, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const ALL_SYMPTOMS = [
  'Burning', 'Itching', 'Thermodysregulation', 'Flaking',
  'Oozing', 'Swelling', 'Redness', 'Insomnia'
];

type TimeRange = '7' | '30' | 'all';

interface SymptomsInsightsProps {
  checkIns: CheckIn[];
}

const SymptomsInsights = ({ checkIns }: SymptomsInsightsProps) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('7');

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

  // Get unique days with check-ins in the range
  const daysWithCheckIns = useMemo(() => {
    const uniqueDays = new Set<string>();
    filteredCheckIns.forEach(c => {
      uniqueDays.add(format(new Date(c.timestamp), 'yyyy-MM-dd'));
    });
    return uniqueDays.size;
  }, [filteredCheckIns]);

  // Calculate symptom frequency
  const symptomStats = useMemo(() => {
    const symptomDays: Record<string, Set<string>> = {};
    
    // Initialize all symptoms
    ALL_SYMPTOMS.forEach(s => {
      symptomDays[s] = new Set();
    });
    
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
    
    // Convert to array and calculate percentages
    return Object.entries(symptomDays)
      .map(([symptom, days]) => ({
        symptom,
        count: days.size,
        percentage: daysWithCheckIns > 0 ? Math.round((days.size / daysWithCheckIns) * 100) : 0,
      }))
      .filter(s => s.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [filteredCheckIns, daysWithCheckIns]);

  // Weekly trend data for chart
  const weeklyTrend = useMemo(() => {
    if (filteredCheckIns.length === 0) return [];
    
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
    
    return recentWeeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
      const weekCheckIns = filteredCheckIns.filter(c => {
        const d = new Date(c.timestamp);
        return isWithinInterval(d, { start: weekStart, end: weekEnd });
      });
      
      // Count days with each symptom this week
      const symptomCounts: Record<string, number> = {};
      const daySymptoms: Record<string, Set<string>> = {};
      
      weekCheckIns.forEach(c => {
        const dateStr = format(new Date(c.timestamp), 'yyyy-MM-dd');
        const symptoms = c.symptomsExperienced || [];
        
        symptoms.forEach(s => {
          if (!daySymptoms[s]) daySymptoms[s] = new Set();
          daySymptoms[s].add(dateStr);
        });
      });
      
      Object.entries(daySymptoms).forEach(([s, days]) => {
        symptomCounts[s] = days.size;
      });
      
      return {
        weekLabel: format(weekStart, 'MMM d'),
        counts: symptomCounts,
        totalDays: new Set(weekCheckIns.map(c => format(new Date(c.timestamp), 'yyyy-MM-dd'))).size,
      };
    });
  }, [filteredCheckIns, checkIns, timeRange]);

  // Get top symptoms for trend chart (max 4 for readability)
  const topSymptoms = useMemo(() => {
    return symptomStats.slice(0, 4).map(s => s.symptom);
  }, [symptomStats]);

  // Check if we have any symptom data
  const hasSymptomData = symptomStats.length > 0;

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
        
        <p className="text-xs text-muted-foreground">
          Based on your daily check-ins
        </p>

        {!hasSymptomData ? (
          /* Empty state */
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
            {weeklyTrend.length > 1 && topSymptoms.length > 0 && (
              <div className="pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-3 font-medium">Weekly trend</p>
                
                {/* Legend */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {topSymptoms.map(symptom => (
                    <div key={symptom} className="flex items-center gap-1">
                      <div className={cn('w-2 h-2 rounded-full', symptomColors[symptom] || 'bg-gray-400')} />
                      <span className="text-[10px] text-muted-foreground">{symptom}</span>
                    </div>
                  ))}
                </div>
                
                {/* Chart */}
                <div className="flex items-end gap-1 h-20">
                  {weeklyTrend.map((week, weekIndex) => (
                    <div key={week.weekLabel} className="flex-1 flex flex-col items-center gap-0.5">
                      {/* Stacked bars for each symptom */}
                      <div className="w-full flex flex-col-reverse gap-0.5 h-16">
                        {topSymptoms.map(symptom => {
                          const count = week.counts[symptom] || 0;
                          const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                          
                          return (
                            <div
                              key={symptom}
                              className={cn(
                                'w-full rounded-sm transition-all duration-300',
                                symptomColors[symptom] || 'bg-gray-400',
                                count === 0 && 'opacity-0'
                              )}
                              style={{ 
                                height: `${height}%`,
                                minHeight: count > 0 ? '4px' : '0px',
                              }}
                              title={`${symptom}: ${count} days`}
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
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SymptomsInsights;
