import { useMemo, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { CheckIn } from '@/contexts/UserDataContext';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, ReferenceArea, Tooltip } from 'recharts';
import { DailyFlareState } from '@/utils/flareStateEngine';
import { Button } from '@/components/ui/button';

const MIN_PAIN_ENTRIES = 5;

interface PainTrendsInsightsProps {
  checkIns: CheckIn[];
  dailyFlareStates: DailyFlareState[];
}

const PainTrendsInsights = ({ checkIns, dailyFlareStates }: PainTrendsInsightsProps) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date());

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

  // Get check-ins with non-null pain scores, filtered by month
  const painData = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    const checkInsWithPain = checkIns
      .filter(c => {
        if (c.painScore === null || c.painScore === undefined) return false;
        const date = new Date(c.timestamp);
        return date >= monthStart && date <= monthEnd;
      })
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
  }, [checkIns, selectedMonth]);

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
    }));
  }, [painData]);

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
                      fill="hsl(var(--muted))"
                      fillOpacity={0.4}
                    />
                  ))}
                  
                  <XAxis 
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'd')}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                    interval={0}
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

            {flarePeriods.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded bg-muted/60" />
                <span>Shaded areas indicate active flare periods</span>
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
