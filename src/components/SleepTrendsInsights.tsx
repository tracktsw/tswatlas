import { useMemo } from 'react';
import { Moon } from 'lucide-react';
import { CheckIn } from '@/contexts/UserDataContext';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceArea, Tooltip, Cell } from 'recharts';
import { DailyFlareState } from '@/utils/flareStateEngine';

const MIN_SLEEP_ENTRIES = 5;

const sleepLabels = ['Very poor', 'Poor', 'Okay', 'Good', 'Very good'];

interface SleepTrendsInsightsProps {
  checkIns: CheckIn[];
  dailyFlareStates: DailyFlareState[];
}

const SleepTrendsInsights = ({ checkIns, dailyFlareStates }: SleepTrendsInsightsProps) => {
  // Get check-ins with non-null sleep scores
  const sleepData = useMemo(() => {
    const checkInsWithSleep = checkIns
      .filter(c => c.sleepScore !== null && c.sleepScore !== undefined)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Group by date, take average sleep score per day
    const byDate = new Map<string, { date: string; sleepScore: number; count: number }>();
    
    checkInsWithSleep.forEach(c => {
      const dateStr = format(new Date(c.timestamp), 'yyyy-MM-dd');
      const existing = byDate.get(dateStr);
      if (existing) {
        // Average the sleep scores for the day
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
        flareState?.flareState === 'peak_flare';

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
    if (sleepData.length < MIN_SLEEP_ENTRIES) return null;

    const scores = sleepData.map(d => d.sleepScore);
    const avgSleep = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    // Calculate variance to determine stability
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgSleep, 2), 0) / scores.length;
    const isStable = variance < 1; // Low variance = stable

    // Compare sleep during flare vs non-flare
    const flareSleepScores: number[] = [];
    const nonFlareSleepScores: number[] = [];

    sleepData.forEach(entry => {
      const flareState = flareStateByDate.get(entry.date);
      const isFlaring = flareState?.isInFlareEpisode || 
        flareState?.flareState === 'active_flare' || 
        flareState?.flareState === 'peak_flare';

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

    // Determine which observational sentence to show
    if (avgFlareSleep !== null && avgNonFlareSleep !== null && flareSleepScores.length >= 2) {
      if (avgNonFlareSleep > avgFlareSleep + 0.5) {
        return "Sleep quality tends to be lower during flare periods.";
      } else if (Math.abs(avgFlareSleep - avgNonFlareSleep) <= 0.5) {
        return "Sleep varies independently of skin symptoms on some days.";
      }
    }

    if (isStable) {
      return "Sleep has been more stable over recent check-ins.";
    }

    // Default observational statement
    return "Sleep quality varies across your check-ins.";
  }, [sleepData, flareStateByDate]);

  // Chart data
  const chartData = useMemo(() => {
    return sleepData.map(entry => {
      const flareState = flareStateByDate.get(entry.date);
      const isFlaring = flareState?.isInFlareEpisode || 
        flareState?.flareState === 'active_flare' || 
        flareState?.flareState === 'peak_flare';
      
      return {
        date: entry.date,
        displayDate: format(new Date(entry.date), 'MMM d'),
        sleepScore: entry.sleepScore,
        isFlaring,
      };
    });
  }, [sleepData, flareStateByDate]);

  // Show nothing if insufficient data
  if (sleepData.length < MIN_SLEEP_ENTRIES) {
    return null;
  }

  return (
    <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.25s' }}>
      <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-indigo-500/20">
          <Moon className="w-4 h-4 text-indigo-500" />
        </div>
        Sleep Trends
      </h3>
      
      <div className="glass-card p-5 space-y-4">
        {/* Chart */}
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              {/* Flare period background shading - subtle */}
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
                tickFormatter={(value) => format(new Date(value), 'MMM d')}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis 
                domain={[0, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                width={30}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0].payload;
                  const label = sleepLabels[Math.round(data.sleepScore) - 1] || '';
                  return (
                    <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg">
                      <p className="text-xs text-muted-foreground">{format(new Date(data.date), 'MMM d, yyyy')}</p>
                      <p className="text-sm font-medium text-foreground">Sleep: {label}</p>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="sleepScore"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`}
                    fill={entry.isFlaring 
                      ? 'hsl(var(--muted-foreground))' 
                      : 'hsl(239 84% 67%)'  // indigo-500
                    }
                    fillOpacity={entry.isFlaring ? 0.5 : 0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend for shading */}
        {flarePeriods.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-3 h-3 rounded bg-muted/60" />
            <span>Shaded areas indicate flare periods</span>
          </div>
        )}

        {/* Observational summary */}
        {summary && (
          <p className="text-sm text-muted-foreground italic border-l-2 border-indigo-500/30 pl-3">
            {summary}
          </p>
        )}
      </div>
    </div>
  );
};

export default SleepTrendsInsights;
