import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { CheckIn } from '@/contexts/UserDataContext';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, ReferenceArea, Tooltip } from 'recharts';
import { DailyFlareState } from '@/utils/flareStateEngine';

const MIN_PAIN_ENTRIES = 5;

interface PainTrendsInsightsProps {
  checkIns: CheckIn[];
  dailyFlareStates: DailyFlareState[];
}

const PainTrendsInsights = ({ checkIns, dailyFlareStates }: PainTrendsInsightsProps) => {
  // Get check-ins with non-null pain scores
  const painData = useMemo(() => {
    const checkInsWithPain = checkIns
      .filter(c => c.painScore !== null && c.painScore !== undefined)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Group by date, take max pain score per day
    const byDate = new Map<string, { date: string; painScore: number; timestamp: string }>();
    
    checkInsWithPain.forEach(c => {
      const dateStr = format(new Date(c.timestamp), 'yyyy-MM-dd');
      const existing = byDate.get(dateStr);
      if (!existing || (c.painScore ?? 0) > existing.painScore) {
        byDate.set(dateStr, {
          date: dateStr,
          painScore: c.painScore ?? 0,
          timestamp: c.timestamp,
        });
      }
    });

    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
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
  }, [painData, flareStateByDate]);

  // Calculate summary statistics for observational text
  const summary = useMemo(() => {
    if (painData.length < MIN_PAIN_ENTRIES) return null;

    const scores = painData.map(d => d.painScore);
    const avgPain = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    // Calculate variance to determine stability
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgPain, 2), 0) / scores.length;
    const isStable = variance < 4; // Low variance = stable

    // Compare pain during flare vs non-flare
    const flarePainScores: number[] = [];
    const nonFlarePainScores: number[] = [];

    painData.forEach(entry => {
      const flareState = flareStateByDate.get(entry.date);
      const isFlaring = flareState?.isInFlareEpisode || 
        flareState?.flareState === 'active_flare' || 
        flareState?.flareState === 'peak_flare';

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

    // Determine which observational sentence to show
    if (avgFlarePain !== null && avgNonFlarePain !== null && flarePainScores.length >= 2) {
      if (avgFlarePain > avgNonFlarePain + 1.5) {
        return "Pain levels tend to be higher during flare periods.";
      } else if (Math.abs(avgFlarePain - avgNonFlarePain) <= 1.5) {
        return "Pain varies independently of skin intensity on some days.";
      }
    }

    if (isStable) {
      return "Pain has been relatively stable over recent check-ins.";
    }

    // Default observational statement
    return "Pain levels vary across your check-ins.";
  }, [painData, flareStateByDate]);

  // Chart data
  const chartData = useMemo(() => {
    return painData.map(entry => ({
      date: entry.date,
      displayDate: format(new Date(entry.date), 'MMM d'),
      painScore: entry.painScore,
    }));
  }, [painData]);

  // Show placeholder if insufficient data
  if (painData.length < MIN_PAIN_ENTRIES) {
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
              {painData.length === 0 
                ? "No pain data yet" 
                : `${painData.length} of ${MIN_PAIN_ENTRIES} entries logged`}
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
      <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-amber-500/20">
          <Activity className="w-4 h-4 text-amber-500" />
        </div>
        Pain Trends
      </h3>
      
      <div className="glass-card p-5 space-y-4">
        {/* Chart */}
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              {/* Flare period background shading */}
              {flarePeriods.map((period, idx) => (
                <ReferenceArea
                  key={idx}
                  x1={period.start}
                  x2={period.end}
                  y1={0}
                  y2={10}
                  fill="hsl(var(--muted))"
                  fillOpacity={0.4}
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
                  return (
                    <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg">
                      <p className="text-xs text-muted-foreground">{format(new Date(data.date), 'MMM d, yyyy')}</p>
                      <p className="text-sm font-medium text-foreground">Pain: {data.painScore}/10</p>
                    </div>
                  );
                }}
              />
              <ReferenceLine y={5} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="painScore"
                stroke="hsl(var(--amber-500, 245 158 11))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--amber-500, 245 158 11))', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: 'hsl(var(--amber-500, 245 158 11))' }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend for shading */}
        {flarePeriods.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-3 h-3 rounded bg-muted/60" />
            <span>Shaded areas indicate active flare periods</span>
          </div>
        )}

        {/* Observational summary */}
        {summary && (
          <p className="text-sm text-muted-foreground italic border-l-2 border-amber-500/30 pl-3">
            {summary}
          </p>
        )}
      </div>
    </div>
  );
};

export default PainTrendsInsights;
