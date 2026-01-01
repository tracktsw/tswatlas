import { useMemo, useState, useEffect } from 'react';
import { Activity, Lock, ChevronDown, TrendingUp } from 'lucide-react';
import { CheckIn } from '@/contexts/UserDataContext';
import { format, subDays, startOfDay, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { severityColors, severityLabels } from '@/constants/severityColors';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

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

  // Severity trend chart data - compute independently for each time bucket
  const severityTrendData = useMemo(() => {
    const now = startOfDay(new Date());
    
    // Determine date range for severity trend based on tab
    let startDate: Date;
    let rangeCheckIns: CheckIn[];
    
    if (timeRange === 'all') {
      rangeCheckIns = checkIns;
      if (checkIns.length === 0) return { data: [], granularity: 'daily' as const, symptoms: [] };
      const oldest = checkIns.reduce((min, c) => {
        const d = new Date(c.timestamp);
        return d < min ? d : min;
      }, new Date());
      startDate = startOfDay(oldest);
    } else {
      const daysBack = timeRange === '7' ? 6 : 29;
      startDate = subDays(now, daysBack);
      rangeCheckIns = checkIns.filter(c => new Date(c.timestamp) >= startDate);
    }

    // Count unique days with severity data
    const daysWithSeverity = new Set<string>();
    rangeCheckIns.forEach(c => {
      const symptoms = c.symptomsExperienced || [];
      if (symptoms.some(s => s.severity !== undefined)) {
        daysWithSeverity.add(format(new Date(c.timestamp), 'yyyy-MM-dd'));
      }
    });

    if (daysWithSeverity.size < 3) {
      return { data: [], granularity: 'daily' as const, symptoms: [], insufficientData: true };
    }

    // Get all symptoms with severity data in this range
    const symptomCounts: Record<string, number> = {};
    rangeCheckIns.forEach(c => {
      (c.symptomsExperienced || []).forEach(entry => {
        if (entry.severity !== undefined) {
          symptomCounts[entry.symptom] = (symptomCounts[entry.symptom] || 0) + 1;
        }
      });
    });
    
    const allSymptoms = Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([symptom]) => symptom);

    // Determine granularity based on timeRange and total days
    const totalDays = differenceInDays(now, startDate) + 1;
    let granularity: 'daily' | 'weekly' | 'monthly';
    
    if (timeRange === '7' || timeRange === '30') {
      granularity = 'daily';
    } else {
      // All time - auto-aggregate
      if (totalDays <= 60) {
        granularity = 'daily';
      } else if (totalDays <= 365) {
        granularity = 'weekly';
      } else {
        granularity = 'monthly';
      }
    }

    // Build buckets based on granularity
    let buckets: { start: Date; end: Date; label: string }[] = [];
    
    if (granularity === 'daily') {
      const days = eachDayOfInterval({ start: startDate, end: now });
      buckets = days.map(day => ({
        start: startOfDay(day),
        end: new Date(startOfDay(day).getTime() + 24 * 60 * 60 * 1000 - 1),
        label: format(day, 'MMM d')
      }));
    } else if (granularity === 'weekly') {
      const weeks = eachWeekOfInterval({ start: startDate, end: now }, { weekStartsOn: 0 });
      buckets = weeks.map(weekStart => ({
        start: startOfWeek(weekStart, { weekStartsOn: 0 }),
        end: endOfWeek(weekStart, { weekStartsOn: 0 }),
        label: format(weekStart, 'MMM d')
      }));
    } else {
      const months = eachMonthOfInterval({ start: startDate, end: now });
      buckets = months.map(monthStart => ({
        start: startOfMonth(monthStart),
        end: endOfMonth(monthStart),
        label: format(monthStart, 'MMM yyyy')
      }));
    }

    // Calculate average severity per symptom per bucket
    const data = buckets.map(bucket => {
      const bucketCheckIns = rangeCheckIns.filter(c => {
        const d = new Date(c.timestamp);
        return isWithinInterval(d, { start: bucket.start, end: bucket.end });
      });

      const result: Record<string, number | null | string | Date> = { 
        label: bucket.label,
        date: bucket.start
      };

      allSymptoms.forEach(symptom => {
        const severities: number[] = [];
        bucketCheckIns.forEach(c => {
          (c.symptomsExperienced || []).forEach(entry => {
            if (entry.symptom === symptom && entry.severity !== undefined) {
              severities.push(entry.severity);
            }
          });
        });

        if (severities.length > 0) {
          result[symptom] = severities.reduce((a, b) => a + b, 0) / severities.length;
        } else {
          result[symptom] = null; // Gap - no data for this symptom in this bucket
        }
      });

      return result;
    });

    return { data, granularity, symptoms: allSymptoms };
  }, [checkIns, timeRange]);

  // Get top 3 symptoms for default visibility
  const top3Symptoms = useMemo(() => {
    return severityTrendData.symptoms.slice(0, 3);
  }, [severityTrendData.symptoms]);

  // Reset hidden symptoms when time range changes, showing only top 3 by default
  useEffect(() => {
    if (severityTrendData.symptoms.length > 0) {
      const toHide = new Set(severityTrendData.symptoms.filter(s => !top3Symptoms.includes(s)));
      setHiddenSymptoms(toHide);
    }
  }, [timeRange, severityTrendData.symptoms, top3Symptoms]);

  // Weekly trend for frequency chart (existing)
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

  // Stroke colors for recharts lines (hex values)
  const symptomStrokeColors: Record<string, string> = {
    'Burning': '#f87171',
    'Itching': '#fb923c',
    'Thermodysregulation': '#c084fc',
    'Flaking': '#fbbf24',
    'Oozing': '#eab308',
    'Swelling': '#f472b6',
    'Redness': '#fb7185',
    'Insomnia': '#818cf8',
  };

  // Generate a consistent color for unknown symptoms
  const getStrokeColor = (symptom: string) => {
    if (symptomStrokeColors[symptom]) return symptomStrokeColors[symptom];
    // Generate a consistent color based on symptom name hash
    let hash = 0;
    for (let i = 0; i < symptom.length; i++) {
      hash = symptom.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 60%, 55%)`;
  };

  // Custom Y-axis tick formatter
  const severityTickFormatter = (value: number) => {
    if (value === 1) return 'Mild';
    if (value === 2) return 'Mod';
    if (value === 3) return 'Sev';
    return '';
  };

  // X-axis tick interval based on granularity and data length
  const getXAxisInterval = () => {
    const dataLength = severityTrendData.data.length;
    if (timeRange === '7') return 0; // Show all 7 days
    if (timeRange === '30') {
      if (dataLength <= 10) return 0;
      return Math.floor(dataLength / 6); // Show ~6 labels
    }
    // All time
    if (dataLength <= 10) return 0;
    if (dataLength <= 20) return 1;
    return Math.floor(dataLength / 8);
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

            {/* Severity trend chart - gated behind 30 days threshold */}
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
            ) : (
              <div className="pt-4 border-t border-border/50">
                {/* Collapsible severity trends section */}
                <Collapsible open={severityTrendOpen} onOpenChange={setSeverityTrendOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">Severity trends</span>
                      </div>
                      <ChevronDown className={cn(
                        'w-4 h-4 text-muted-foreground transition-transform duration-200',
                        severityTrendOpen && 'rotate-180'
                      )} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    {severityTrendData.insufficientData ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">
                          Not enough data yet. Log symptom severity on at least 3 days to see trends.
                        </p>
                      </div>
                    ) : severityTrendData.data.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">
                          No severity data available for this time range.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Legend - clickable chips */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {severityTrendData.symptoms.map(symptom => {
                            const isHidden = hiddenSymptoms.has(symptom);
                            return (
                              <button
                                key={symptom}
                                onClick={() => toggleSymptomVisibility(symptom)}
                                className={cn(
                                  'relative flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 overflow-hidden max-w-[160px]',
                                  isHidden 
                                    ? 'opacity-40 bg-muted/30' 
                                    : 'bg-muted/50 hover:bg-muted'
                                )}
                              >
                                <div 
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-opacity"
                                  style={{ backgroundColor: getStrokeColor(symptom), opacity: isHidden ? 0.5 : 1 }}
                                />
                                <span className={cn(
                                  'text-xs font-medium truncate',
                                  isHidden ? 'text-muted-foreground/50 line-through' : 'text-muted-foreground'
                                )}>
                                  {symptom}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        
                        {/* Line chart */}
                        <div className="h-48 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={severityTrendData.data}
                              margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                              <XAxis 
                                dataKey="label" 
                                tick={{ fontSize: 10 }}
                                interval={getXAxisInterval()}
                                axisLine={{ strokeOpacity: 0.3 }}
                                tickLine={{ strokeOpacity: 0.3 }}
                              />
                              <YAxis 
                                domain={[1, 3]}
                                ticks={[1, 2, 3]}
                                tickFormatter={severityTickFormatter}
                                tick={{ fontSize: 10 }}
                                axisLine={{ strokeOpacity: 0.3 }}
                                tickLine={{ strokeOpacity: 0.3 }}
                                width={35}
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  fontSize: 12, 
                                  backgroundColor: 'hsl(var(--popover))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px'
                                }}
                                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                                formatter={(value: number | null, name: string) => {
                                  if (value === null) return ['-', name];
                                  const label = value <= 1.5 ? 'Mild' : value <= 2.5 ? 'Moderate' : 'Severe';
                                  return [`${value.toFixed(1)} (${label})`, name];
                                }}
                              />
                              {severityTrendData.symptoms.map(symptom => {
                                if (hiddenSymptoms.has(symptom)) return null;
                                return (
                                  <Line
                                    key={symptom}
                                    type="monotone"
                                    dataKey={symptom}
                                    stroke={getStrokeColor(symptom)}
                                    strokeWidth={2}
                                    dot={{ r: 3, strokeWidth: 0, fill: getStrokeColor(symptom) }}
                                    activeDot={{ r: 5 }}
                                    connectNulls={false}
                                  />
                                );
                              })}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        
                        <p className="text-[10px] text-muted-foreground/70 mt-2 text-center italic">
                          {severityTrendData.granularity === 'daily' 
                            ? 'Daily average severity per symptom (Mild=1, Mod=2, Severe=3)'
                            : severityTrendData.granularity === 'weekly'
                            ? 'Weekly average severity per symptom (Mild=1, Mod=2, Severe=3)'
                            : 'Monthly average severity per symptom (Mild=1, Mod=2, Severe=3)'
                          }
                        </p>
                      </>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SymptomsInsights;
