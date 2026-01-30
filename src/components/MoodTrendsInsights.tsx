import { useMemo, useState } from 'react';
import { Smile, ChevronLeft, ChevronRight } from 'lucide-react';
import { CheckIn } from '@/contexts/UserDataContext';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, ReferenceArea, Tooltip } from 'recharts';
import { DailyFlareState } from '@/utils/flareStateEngine';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';

const MIN_MOOD_ENTRIES = 5;

const moodLabels = ['Very Low', 'Low', 'Okay', 'Good', 'Great'];

interface MoodTrendsInsightsProps {
  checkIns: CheckIn[];
  dailyFlareStates: DailyFlareState[];
}

const MoodTrendsInsights = ({ checkIns, dailyFlareStates }: MoodTrendsInsightsProps) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const { theme } = useTheme();
  
  // Line color: black in light mode, yellow in dark mode
  const lineColor = theme === 'dark' ? '#facc15' : '#171717';

  // Get the earliest and latest dates with mood data
  const dateRange = useMemo(() => {
    const datesWithMood = checkIns
      .filter(c => c.mood !== null && c.mood !== undefined)
      .map(c => new Date(c.timestamp));
    
    if (datesWithMood.length === 0) return { earliest: new Date(), latest: new Date() };
    
    return {
      earliest: new Date(Math.min(...datesWithMood.map(d => d.getTime()))),
      latest: new Date(Math.max(...datesWithMood.map(d => d.getTime()))),
    };
  }, [checkIns]);

  const canGoBack = !isSameMonth(selectedMonth, dateRange.earliest);
  const canGoForward = !isSameMonth(selectedMonth, dateRange.latest);

  // Get check-ins with mood scores for the month, including triggers
  const moodDataWithTriggers = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    const checkInsWithMood = checkIns
      .filter(c => {
        if (c.mood === null || c.mood === undefined) return false;
        const date = new Date(c.timestamp);
        return date >= monthStart && date <= monthEnd;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Group by date, take average mood score and collect all triggers
    const byDate = new Map<string, { date: string; moodScore: number; triggers: string[]; count: number }>();
    
    checkInsWithMood.forEach(c => {
      const dateStr = format(new Date(c.timestamp), 'yyyy-MM-dd');
      const existing = byDate.get(dateStr);
      if (existing) {
        // Average the mood scores
        existing.moodScore = (existing.moodScore * existing.count + c.mood) / (existing.count + 1);
        existing.count++;
        // Merge triggers
        c.triggers?.forEach(t => {
          if (!existing.triggers.includes(t)) {
            existing.triggers.push(t);
          }
        });
      } else {
        byDate.set(dateStr, {
          date: dateStr,
          moodScore: c.mood,
          triggers: [...(c.triggers || [])],
          count: 1,
        });
      }
    });

    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [checkIns, selectedMonth]);

  // Simple moodData for chart
  const moodData = useMemo(() => {
    return moodDataWithTriggers.map(d => ({
      date: d.date,
      moodScore: d.moodScore,
      timestamp: d.date,
    }));
  }, [moodDataWithTriggers]);

  // Total mood entries across all time
  const totalMoodEntries = useMemo(() => {
    return checkIns.filter(c => c.mood !== null && c.mood !== undefined).length;
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

    moodData.forEach(entry => {
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
  }, [moodData, flareStateByDate]);

  // Calculate summary statistics for observational text
  const summary = useMemo(() => {
    if (moodData.length < 3) return null;

    const scores = moodData.map(d => d.moodScore);
    const avgMood = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgMood, 2), 0) / scores.length;
    const isStable = variance < 1;

    const flareMoodScores: number[] = [];
    const nonFlareMoodScores: number[] = [];

    moodData.forEach(entry => {
      const flareState = flareStateByDate.get(entry.date);
      const isFlaring = flareState?.isInFlareEpisode || 
        flareState?.flareState === 'active_flare' ||
        flareState?.flareState === 'early_flare';
      if (isFlaring) {
        flareMoodScores.push(entry.moodScore);
      } else {
        nonFlareMoodScores.push(entry.moodScore);
      }
    });

    const avgFlareMood = flareMoodScores.length > 0 
      ? flareMoodScores.reduce((a, b) => a + b, 0) / flareMoodScores.length 
      : null;
    const avgNonFlareMood = nonFlareMoodScores.length > 0 
      ? nonFlareMoodScores.reduce((a, b) => a + b, 0) / nonFlareMoodScores.length 
      : null;

    if (avgFlareMood !== null && avgNonFlareMood !== null && flareMoodScores.length >= 2) {
      if (avgFlareMood < avgNonFlareMood - 0.5) {
        return "Mood tends to be lower during flare periods.";
      } else if (Math.abs(avgFlareMood - avgNonFlareMood) <= 0.5) {
        return "Mood remains relatively stable regardless of flares.";
      }
    }

    if (isStable) {
      return "Mood has been stable this month.";
    }

    return "Mood varies across this month.";
  }, [moodData, flareStateByDate]);

  // Chart data
  const chartData = useMemo(() => {
    return moodData.map(entry => ({
      date: entry.date,
      displayDate: format(new Date(entry.date), 'd'),
      moodScore: entry.moodScore,
    }));
  }, [moodData]);

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
  if (totalMoodEntries < MIN_MOOD_ENTRIES) {
    return (
      <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.25s' }}>
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/20">
            <Smile className="w-4 h-4 text-blue-500" />
          </div>
          Mood Trends
        </h3>
        
        <div className="glass-card p-5">
          <div className="text-center py-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Smile className="w-6 h-6 text-blue-500/50" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {totalMoodEntries === 0 
                ? "No mood data yet" 
                : `${totalMoodEntries} of ${MIN_MOOD_ENTRIES} entries logged`}
            </p>
            <p className="text-xs text-muted-foreground">
              Log mood in your check-ins to see trends over time
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
          <div className="p-1.5 rounded-lg bg-blue-500/20">
            <Smile className="w-4 h-4 text-blue-500" />
          </div>
          Mood Trends
        </h3>
        <MonthNavigator />
      </div>
      
      <div className="glass-card p-5 space-y-4">
        {moodData.length === 0 ? (
          <div className="text-center py-6">
            <Smile className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No mood data for {format(selectedMonth, 'MMMM yyyy')}
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
                      y1={1}
                      y2={5}
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
                    domain={[1, 5]}
                    ticks={[1, 2, 3, 4, 5]}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                    width={30}
                    tickFormatter={(value) => ['😢', '😕', '😐', '🙂', '😊'][value - 1] || ''}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      const moodIndex = Math.round(data.moodScore) - 1;
                      return (
                        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg">
                          <p className="text-xs text-muted-foreground">{format(new Date(data.date), 'MMM d, yyyy')}</p>
                          <p className="text-sm font-medium text-foreground">
                            Mood: {moodLabels[moodIndex]} ({data.moodScore.toFixed(1)}/5)
                          </p>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine y={3} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="moodScore"
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

            {/* Summary text */}
            {summary && (
              <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                {summary}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MoodTrendsInsights;
