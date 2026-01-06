import { useMemo, useState } from 'react';
import { Moon, ChevronLeft, ChevronRight } from 'lucide-react';
import { CheckIn } from '@/contexts/UserDataContext';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceArea, ReferenceLine, Tooltip } from 'recharts';
import { DailyFlareState } from '@/utils/flareStateEngine';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const MIN_SLEEP_ENTRIES = 5;

const sleepLabels = ['Very poor', 'Poor', 'Okay', 'Good', 'Very good'];

interface SleepTrendsInsightsProps {
  checkIns: CheckIn[];
  dailyFlareStates: DailyFlareState[];
}

const SleepTrendsInsights = ({ checkIns, dailyFlareStates }: SleepTrendsInsightsProps) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Get the earliest and latest dates with sleep data
  const dateRange = useMemo(() => {
    const datesWithSleep = checkIns
      .filter(c => c.sleepScore !== null && c.sleepScore !== undefined)
      .map(c => new Date(c.timestamp));
    
    if (datesWithSleep.length === 0) return { earliest: new Date(), latest: new Date() };
    
    return {
      earliest: new Date(Math.min(...datesWithSleep.map(d => d.getTime()))),
      latest: new Date(Math.max(...datesWithSleep.map(d => d.getTime()))),
    };
  }, [checkIns]);

  const canGoBack = !isSameMonth(selectedMonth, dateRange.earliest);
  const canGoForward = !isSameMonth(selectedMonth, dateRange.latest);

  // Get check-ins with non-null sleep scores, filtered by month
  const sleepData = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    const checkInsWithSleep = checkIns
      .filter(c => {
        if (c.sleepScore === null || c.sleepScore === undefined) return false;
        const date = new Date(c.timestamp);
        return date >= monthStart && date <= monthEnd;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Group by date, take average sleep score per day
    const byDate = new Map<string, { date: string; sleepScore: number; count: number }>();
    
    checkInsWithSleep.forEach(c => {
      const dateStr = format(new Date(c.timestamp), 'yyyy-MM-dd');
      const existing = byDate.get(dateStr);
      if (existing) {
        const newTotal = existing.sleepScore * existing.count + (c.sleepScore ?? 0);
        existing.count++;
        existing.sleepScore = newTotal / existing.count;
      } else {
        byDate.set(dateStr, {
          date: dateStr,
          sleepScore: c.sleepScore ?? 0,
          count: 1,
        });
      }
    });

    return Array.from(byDate.values())
      .map(d => ({ date: d.date, sleepScore: Math.round(d.sleepScore * 10) / 10 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [checkIns, selectedMonth]);

  // Total sleep entries across all time
  const totalSleepEntries = useMemo(() => {
    return checkIns.filter(c => c.sleepScore !== null && c.sleepScore !== undefined).length;
  }, [checkIns]);

  // Build flare state lookup
  const flareStateByDate = useMemo(() => {
    const lookup = new Map<string, DailyFlareState>();
    dailyFlareStates.forEach(state => {
      lookup.set(state.date, state);
    });
    return lookup;
  }, [dailyFlareStates]);

  // Identify flare periods for subtle background shading
  const flarePeriods = useMemo(() => {
    const periods: { start: string; end: string }[] = [];
    let currentPeriod: { start: string; end: string } | null = null;

    sleepData.forEach(entry => {
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
  }, [sleepData, flareStateByDate]);

  // Calculate summary statistics for observational text
  const summary = useMemo(() => {
    if (sleepData.length < 3) return null;

    const scores = sleepData.map(d => d.sleepScore);
    const avgSleep = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgSleep, 2), 0) / scores.length;
    const isStable = variance < 1;

    const flareSleepScores: number[] = [];
    const nonFlareSleepScores: number[] = [];

    sleepData.forEach(entry => {
      const flareState = flareStateByDate.get(entry.date);
      const isFlaring = flareState?.isInFlareEpisode || 
        flareState?.flareState === 'active_flare' ||
        flareState?.flareState === 'early_flare';
      if (isFlaring) {
        flareSleepScores.push(entry.sleepScore);
      } else {
        nonFlareSleepScores.push(entry.sleepScore);
      }
    });

    const avgFlareSleep = flareSleepScores.length > 0 
      ? flareSleepScores.reduce((a, b) => a + b, 0) / flareSleepScores.length 
      : null;
    const avgNonFlareSleep = nonFlareSleepScores.length > 0 
      ? nonFlareSleepScores.reduce((a, b) => a + b, 0) / nonFlareSleepScores.length 
      : null;

    if (avgFlareSleep !== null && avgNonFlareSleep !== null && flareSleepScores.length >= 2) {
      if (avgNonFlareSleep > avgFlareSleep + 0.5) {
        return "Sleep quality tends to be lower during flare periods.";
      } else if (Math.abs(avgFlareSleep - avgNonFlareSleep) <= 0.5) {
        return "Sleep varies independently of skin symptoms.";
      }
    }

    if (isStable) {
      return "Sleep has been stable this month.";
    }

    return "Sleep quality varies across this month.";
  }, [sleepData, flareStateByDate]);

  // Chart data
  const chartData = useMemo(() => {
    return sleepData.map(entry => {
      const flareState = flareStateByDate.get(entry.date);
      const isFlaring = flareState?.isInFlareEpisode || 
        flareState?.flareState === 'active_flare' ||
        flareState?.flareState === 'early_flare';
      
      return {
        date: entry.date,
        displayDate: format(new Date(entry.date), 'd'),
        sleepScore: entry.sleepScore,
        isFlaring,
      };
    });
  }, [sleepData, flareStateByDate]);

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
  if (totalSleepEntries < MIN_SLEEP_ENTRIES) {
    return (
      <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.25s' }}>
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20">
            <Moon className="w-4 h-4 text-indigo-500" />
          </div>
          Sleep Trends
        </h3>
        
        <div className="glass-card p-5">
          <div className="text-center py-6">
            <Moon className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              {totalSleepEntries} of {MIN_SLEEP_ENTRIES} entries logged
            </p>
            <p className="text-xs text-muted-foreground/70">
              Log a few more check-ins with sleep data to see your trends
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.25s' }}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20">
            <Moon className="w-4 h-4 text-indigo-500" />
          </div>
          Sleep Trends
        </h3>
        <MonthNavigator />
      </div>
      
      <div className="glass-card p-5 space-y-4">
        {sleepData.length === 0 ? (
          <div className="text-center py-6">
            <Moon className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No sleep data for {format(selectedMonth, 'MMMM yyyy')}
            </p>
          </div>
        ) : (
          <>
            {/* Chart */}
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  {flarePeriods.map((period, idx) => (
                    <ReferenceArea
                      key={idx}
                      x1={period.start}
                      x2={period.end}
                      y1={0}
                      y2={5}
                      fill="hsl(var(--muted))"
                      fillOpacity={0.3}
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
                    domain={[0, 5]}
                    ticks={[1, 2, 3, 4, 5]}
                    tickFormatter={(value) => {
                      const labels: Record<number, string> = {
                        1: '😫',
                        2: '😩',
                        3: '😐',
                        4: '🙂',
                        5: '😴',
                      };
                      return labels[value] || '';
                    }}
                    tick={{ fontSize: 14 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      const label = sleepLabels[Math.round(data.sleepScore) - 1] || '';
                      const emoji = ['😫', '😩', '😐', '🙂', '😴'][Math.round(data.sleepScore) - 1] || '';
                      return (
                        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg">
                          <p className="text-xs text-muted-foreground">{format(new Date(data.date), 'MMM d, yyyy')}</p>
                          <p className="text-sm font-medium text-foreground">{emoji} {label}</p>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine y={3} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="sleepScore"
                    stroke="hsl(239 84% 67%)"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(239 84% 67%)', strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, fill: 'hsl(239 84% 67%)' }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {flarePeriods.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded bg-muted/60" />
                <span>Shaded areas indicate flare periods</span>
              </div>
            )}

            {summary && (
              <p className="text-sm text-muted-foreground italic border-l-2 border-indigo-500/30 pl-3">
                {summary}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SleepTrendsInsights;
