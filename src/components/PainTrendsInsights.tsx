import { useMemo, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { CheckIn } from '@/contexts/UserDataContext';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, ReferenceArea, Tooltip } from 'recharts';
import { DailyFlareState } from '@/utils/flareStateEngine';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';

const MIN_PAIN_ENTRIES = 5;
const MIN_TRIGGER_OCCURRENCES = 2;
const MIN_DAYS_FOR_TRIGGER_ANALYSIS = 3;

// Format trigger names: snake_case -> Title Case
const formatTrigger = (trigger: string): string => {
  return trigger
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

interface PainTrendsInsightsProps {
  checkIns: CheckIn[];
  dailyFlareStates: DailyFlareState[];
}

interface TriggerCorrelation {
  trigger: string;
  avgWithTrigger: number;
  avgWithoutTrigger: number;
  difference: number;
  occurrences: number;
}

const PainTrendsInsights = ({ checkIns, dailyFlareStates }: PainTrendsInsightsProps) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const { theme } = useTheme();
  
  // Line color: black in light mode, yellow in dark mode
  const lineColor = theme === 'dark' ? '#facc15' : '#171717';

  // Get the earliest and latest dates with pain data
  const dateRange = useMemo(() => {
    const datesWithPain = checkIns
      .filter(c => c.painScore !== null && c.painScore !== undefined)
      .map(c => new Date(c.timestamp));
    
    if (datesWithPain.length === 0) return { earliest: new Date(), latest: new Date() };
    
    return {
      earliest: new Date(Math.min(...datesWithPain.map(d => d.getTime()))),
      latest: new Date(Math.max(...datesWithPain.map(d => d.getTime()))),
    };
  }, [checkIns]);

  const canGoBack = !isSameMonth(selectedMonth, dateRange.earliest);
  const canGoForward = !isSameMonth(selectedMonth, dateRange.latest);

  // Get check-ins with pain scores for the month, including triggers
  const painDataWithTriggers = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    const checkInsWithPain = checkIns
      .filter(c => {
        if (c.painScore === null || c.painScore === undefined) return false;
        const date = new Date(c.timestamp);
        return date >= monthStart && date <= monthEnd;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Group by date, take max pain score and collect all triggers
    const byDate = new Map<string, { date: string; painScore: number; triggers: string[] }>();
    
    checkInsWithPain.forEach(c => {
      const dateStr = format(new Date(c.timestamp), 'yyyy-MM-dd');
      const existing = byDate.get(dateStr);
      if (existing) {
        if ((c.painScore ?? 0) > existing.painScore) {
          existing.painScore = c.painScore ?? 0;
        }
        // Merge triggers
        c.triggers?.forEach(t => {
          if (!existing.triggers.includes(t)) {
            existing.triggers.push(t);
          }
        });
      } else {
        byDate.set(dateStr, {
          date: dateStr,
          painScore: c.painScore ?? 0,
          triggers: [...(c.triggers || [])],
        });
      }
    });

    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [checkIns, selectedMonth]);

  // Simple painData for chart
  const painData = useMemo(() => {
    return painDataWithTriggers.map(d => ({
      date: d.date,
      painScore: d.painScore,
      timestamp: d.date,
    }));
  }, [painDataWithTriggers]);

  // Calculate trigger correlations
  const triggerCorrelations = useMemo((): TriggerCorrelation[] => {
    if (painDataWithTriggers.length < MIN_DAYS_FOR_TRIGGER_ANALYSIS) return [];

    // Count trigger occurrences and pain scores
    const triggerStats = new Map<string, { withTrigger: number[]; }>();
    const allPainScores: number[] = [];

    painDataWithTriggers.forEach(day => {
      allPainScores.push(day.painScore);
      day.triggers.forEach(trigger => {
        if (!triggerStats.has(trigger)) {
          triggerStats.set(trigger, { withTrigger: [] });
        }
        triggerStats.get(trigger)!.withTrigger.push(day.painScore);
      });
    });

    const overallAvg = allPainScores.reduce((a, b) => a + b, 0) / allPainScores.length;

    // Build correlations
    const correlations: TriggerCorrelation[] = [];
    
    triggerStats.forEach((stats, trigger) => {
      if (stats.withTrigger.length >= MIN_TRIGGER_OCCURRENCES) {
        const avgWithTrigger = stats.withTrigger.reduce((a, b) => a + b, 0) / stats.withTrigger.length;
        
        // Calculate avg without this trigger
        const withoutScores = painDataWithTriggers
          .filter(d => !d.triggers.includes(trigger))
          .map(d => d.painScore);
        const avgWithoutTrigger = withoutScores.length > 0 
          ? withoutScores.reduce((a, b) => a + b, 0) / withoutScores.length
          : overallAvg;

        correlations.push({
          trigger,
          avgWithTrigger,
          avgWithoutTrigger,
          difference: avgWithTrigger - avgWithoutTrigger,
          occurrences: stats.withTrigger.length,
        });
      }
    });

    // Sort by absolute difference (impact)
    return correlations.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference)).slice(0, 4);
  }, [painDataWithTriggers]);

  // Create trigger lookup by date for tooltips
  const triggersByDate = useMemo(() => {
    const lookup = new Map<string, string[]>();
    painDataWithTriggers.forEach(d => {
      lookup.set(d.date, d.triggers);
    });
    return lookup;
  }, [painDataWithTriggers]);

  // Total pain entries across all time
  const totalPainEntries = useMemo(() => {
    return checkIns.filter(c => c.painScore !== null && c.painScore !== undefined).length;
  }, [checkIns]);

  // Build flare state lookup
  const flareStateByDate = useMemo(() => {
    const lookup = new Map<string, DailyFlareState>();
    dailyFlareStates.forEach(state => {
      lookup.set(state.date, state);
    });
    return lookup;
  }, [dailyFlareStates]);

  // Identify flare periods for background shading
  const flarePeriods = useMemo(() => {
    const periods: { start: string; end: string }[] = [];
    let currentPeriod: { start: string; end: string } | null = null;

    painData.forEach(entry => {
      const flareState = flareStateByDate.get(entry.date);
      const isFlaring = flareState?.isInFlareEpisode || 
        flareState?.flareState === 'active_flare' ||
        flareState?.flareState === 'early_flare';
      if (isFlaring) {
        if (!currentPeriod) {
          currentPeriod = { start: entry.date, end: entry.date };
        } else {
          currentPeriod.end = entry.date;
        }
      } else {
        if (currentPeriod) {
          periods.push(currentPeriod);
          currentPeriod = null;
        }
      }
    });

    if (currentPeriod) {
      periods.push(currentPeriod);
    }

    return periods;
  }, [painData, flareStateByDate]);

  // Calculate summary statistics for observational text
  const summary = useMemo(() => {
    if (painData.length < 3) return null;

    const scores = painData.map(d => d.painScore);
    const avgPain = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgPain, 2), 0) / scores.length;
    const isStable = variance < 4;

    const flarePainScores: number[] = [];
    const nonFlarePainScores: number[] = [];

    painData.forEach(entry => {
      const flareState = flareStateByDate.get(entry.date);
      const isFlaring = flareState?.isInFlareEpisode || 
        flareState?.flareState === 'active_flare' ||
        flareState?.flareState === 'early_flare';
      if (isFlaring) {
        flarePainScores.push(entry.painScore);
      } else {
        nonFlarePainScores.push(entry.painScore);
      }
    });

    const avgFlarePain = flarePainScores.length > 0 
      ? flarePainScores.reduce((a, b) => a + b, 0) / flarePainScores.length 
      : null;
    const avgNonFlarePain = nonFlarePainScores.length > 0 
      ? nonFlarePainScores.reduce((a, b) => a + b, 0) / nonFlarePainScores.length 
      : null;

    if (avgFlarePain !== null && avgNonFlarePain !== null && flarePainScores.length >= 2) {
      if (avgFlarePain > avgNonFlarePain + 1.5) {
        return "Pain levels tend to be higher during flare periods.";
      } else if (Math.abs(avgFlarePain - avgNonFlarePain) <= 1.5) {
        return "Pain varies independently of skin intensity.";
      }
    }

    if (isStable) {
      return "Pain has been relatively stable this month.";
    }

    return "Pain levels vary across this month.";
  }, [painData, flareStateByDate]);

  // Chart data
  const chartData = useMemo(() => {
    return painData.map(entry => ({
      date: entry.date,
      displayDate: format(new Date(entry.date), 'd'),
      painScore: entry.painScore,
      triggers: triggersByDate.get(entry.date) || [],
    }));
  }, [painData, triggersByDate]);

  // Calculate tick interval to avoid crowding (show ~6-8 ticks max)
  const tickInterval = useMemo(() => {
    const dataLength = chartData.length;
    if (dataLength <= 7) return 0; // Show all
    if (dataLength <= 14) return 1; // Every other
    if (dataLength <= 21) return 2; // Every 3rd
    return Math.floor(dataLength / 7) - 1; // ~7 ticks
  }, [chartData.length]);

  const MonthNavigator = () => (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setSelectedMonth(prev => subMonths(prev, 1))}
        disabled={!canGoBack}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium min-w-[100px] text-center">
        {format(selectedMonth, 'MMM yyyy')}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setSelectedMonth(prev => addMonths(prev, 1))}
        disabled={!canGoForward}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );

  // Show placeholder if insufficient data overall
  if (totalPainEntries < MIN_PAIN_ENTRIES) {
    return (
      <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/20">
            <Activity className="w-4 h-4 text-amber-500" />
          </div>
          Pain Trends
        </h3>
        
        <div className="glass-card p-5">
          <div className="text-center py-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Activity className="w-6 h-6 text-amber-500/50" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {totalPainEntries === 0 
                ? "No pain data yet" 
                : `${totalPainEntries} of ${MIN_PAIN_ENTRIES} entries logged`}
            </p>
            <p className="text-xs text-muted-foreground">
              Log pain scores in your check-ins to see trends over time
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/20">
            <Activity className="w-4 h-4 text-amber-500" />
          </div>
          Pain Trends
        </h3>
        <MonthNavigator />
      </div>
      
      <div className="glass-card p-5 space-y-4">
        {painData.length === 0 ? (
          <div className="text-center py-6">
            <Activity className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No pain data for {format(selectedMonth, 'MMMM yyyy')}
            </p>
          </div>
        ) : (
          <>
            {/* Chart */}
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  {flarePeriods.map((period, idx) => (
                    <ReferenceArea
                      key={idx}
                      x1={period.start}
                      x2={period.end}
                      y1={0}
                      y2={10}
                      fill="#ef4444"
                      fillOpacity={0.25}
                    />
                  ))}
                  
                  <XAxis 
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'd')}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                    interval={tickInterval}
                  />
                  <YAxis 
                    domain={[0, 10]}
                    ticks={[0, 2, 4, 6, 8, 10]}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      const triggers = data.triggers as string[];
                      return (
                        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg">
                          <p className="text-xs text-muted-foreground">{format(new Date(data.date), 'MMM d, yyyy')}</p>
                          <p className="text-sm font-medium text-foreground">Pain: {data.painScore}/10</p>
                          {triggers.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Triggers: {triggers.slice(0, 3).map(formatTrigger).join(', ')}{triggers.length > 3 ? ` +${triggers.length - 3}` : ''}
                            </p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine y={5} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="painScore"
                    stroke={lineColor}
                    strokeWidth={2}
                    dot={{ fill: lineColor, strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, fill: lineColor }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {flarePeriods.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded bg-red-500/40" />
                <span>Shaded areas indicate active flare periods</span>
              </div>
            )}

            {/* Trigger Correlations */}
            {triggerCorrelations.length > 0 && (
              <div className="pt-2 border-t border-border/50 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Trigger Correlations
                </div>
                <div className="space-y-1.5">
                  {triggerCorrelations.map((corr) => (
                    <div key={corr.trigger} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate max-w-[140px]">{formatTrigger(corr.trigger)}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${corr.difference > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(Math.abs(corr.difference) * 10, 100)}%` }}
                          />
                        </div>
                        <span className={`font-medium min-w-[40px] text-right ${corr.difference > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {corr.difference > 0 ? '+' : ''}{corr.difference.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {triggerCorrelations[0] && triggerCorrelations[0].difference > 0.5 && (
                  <p className="text-xs text-muted-foreground italic">
                    On days with {formatTrigger(triggerCorrelations[0].trigger)}, pain averaged {triggerCorrelations[0].difference.toFixed(1)} points higher
                  </p>
                )}
              </div>
            )}

            {summary && (
              <p className="text-sm text-muted-foreground italic border-l-2 border-amber-500/30 pl-3">
                {summary}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PainTrendsInsights;
