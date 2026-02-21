import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { CheckIn } from '@/contexts/UserDataContext';
import { format, subDays, startOfDay } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, ReferenceArea, Tooltip } from 'recharts';
import { DailyFlareState } from '@/utils/flareStateEngine';
import { cn } from '@/lib/utils';

const MIN_SKIN_ENTRIES = 3;
type TimeRange = '7' | '30' | 'all';

const skinLabels = ['Severe', 'Bad', 'Okay', 'Good', 'Great'];
const skinEmojis = ['🔴', '🟠', '🟡', '🟢', '💚'];

interface SkinProgressInsightsProps {
  checkIns: CheckIn[];
  dailyFlareStates: DailyFlareState[];
}

const SkinProgressInsights = ({ checkIns, dailyFlareStates }: SkinProgressInsightsProps) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('7');

  // Filter check-ins by time range
  const filteredCheckIns = useMemo(() => {
    const withSkin = checkIns.filter(c => c.skinFeeling !== null && c.skinFeeling !== undefined);
    if (timeRange === 'all') return withSkin;
    const now = startOfDay(new Date());
    const daysBack = timeRange === '7' ? 6 : 29;
    const startDate = subDays(now, daysBack);
    return withSkin.filter(c => new Date(c.timestamp) >= startDate);
  }, [checkIns, timeRange]);

  // Total skin entries across all time
  const totalSkinEntries = useMemo(() => {
    return checkIns.filter(c => c.skinFeeling !== null && c.skinFeeling !== undefined).length;
  }, [checkIns]);

  // Group by date, average skinFeeling
  const skinData = useMemo(() => {
    const byDate = new Map<string, { total: number; count: number }>();
    filteredCheckIns.forEach(c => {
      const dateStr = format(new Date(c.timestamp), 'yyyy-MM-dd');
      const existing = byDate.get(dateStr);
      if (existing) {
        existing.total += c.skinFeeling;
        existing.count++;
      } else {
        byDate.set(dateStr, { total: c.skinFeeling, count: 1 });
      }
    });
    return Array.from(byDate.entries())
      .map(([date, { total, count }]) => ({ date, skinScore: total / count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredCheckIns]);

  // Flare state lookup
  const flareStateByDate = useMemo(() => {
    const lookup = new Map<string, DailyFlareState>();
    dailyFlareStates.forEach(s => lookup.set(s.date, s));
    return lookup;
  }, [dailyFlareStates]);

  // Flare periods for shading
  const flarePeriods = useMemo(() => {
    const periods: { start: string; end: string }[] = [];
    let current: { start: string; end: string } | null = null;
    skinData.forEach(entry => {
      const fs = flareStateByDate.get(entry.date);
      const isFlaring = fs?.isInFlareEpisode || fs?.flareState === 'active_flare' || fs?.flareState === 'early_flare';
      if (isFlaring) {
        if (!current) current = { start: entry.date, end: entry.date };
        else current.end = entry.date;
      } else if (current) {
        periods.push(current);
        current = null;
      }
    });
    if (current) periods.push(current);
    return periods;
  }, [skinData, flareStateByDate]);

  // Chart data
  const chartData = useMemo(() => {
    return skinData.map(entry => ({
      date: entry.date,
      displayDate: format(new Date(entry.date), 'd'),
      skinScore: entry.skinScore,
    }));
  }, [skinData]);

  // Tick interval
  const tickInterval = useMemo(() => {
    const len = chartData.length;
    if (len <= 7) return 0;
    if (len <= 14) return 1;
    if (len <= 21) return 2;
    return Math.floor(len / 7) - 1;
  }, [chartData.length]);

  // Summary
  const summary = useMemo(() => {
    if (skinData.length < 3) return null;
    const scores = skinData.map(d => d.skinScore);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const rangeLabel = timeRange === '7' ? 'last 7 days' : timeRange === '30' ? 'last 30 days' : 'tracked period';

    if (avgSecond > avgFirst + 0.3) return `Your skin has been improving over the ${rangeLabel}.`;
    if (avgSecond < avgFirst - 0.3) return `Your skin has been trending worse over the ${rangeLabel}.`;
    return `Your skin has remained fairly stable over the ${rangeLabel}.`;
  }, [skinData, timeRange]);

  const lineColor = '#22c55e';

  // Not enough data
  if (totalSkinEntries < MIN_SKIN_ENTRIES) {
    return (
      <div className="space-y-4 animate-slide-up">
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/20">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          Skin Progress
        </h3>
        <div className="glass-card p-5">
          <div className="text-center py-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary/50" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {totalSkinEntries === 0 ? 'No skin data yet' : `${totalSkinEntries} of ${MIN_SKIN_ENTRIES} entries logged`}
            </p>
            <p className="text-xs text-muted-foreground">
              Log skin feeling in your check-ins to see progress over time
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/20">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          Skin Progress
        </h3>
        {/* Time range toggle */}
        <div className="flex gap-1">
          {(['7', '30', 'all'] as TimeRange[]).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                timeRange === range
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {range === 'all' ? 'All' : `${range}d`}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card p-5 space-y-4">
        {skinData.length === 0 ? (
          <div className="text-center py-6">
            <TrendingUp className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No skin data for this period
            </p>
          </div>
        ) : (
          <>
            <div className={cn('w-full', timeRange === 'all' && chartData.length > 31 ? 'overflow-x-auto' : '')}>
              <div className="h-48" style={{ minWidth: timeRange === 'all' && chartData.length > 31 ? `${chartData.length * 18}px` : '100%' }}>
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
                      tickFormatter={value => format(new Date(value), 'd')}
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
                      tickFormatter={value => skinEmojis[value - 1] || ''}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0].payload;
                        const idx = Math.round(data.skinScore) - 1;
                        return (
                          <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg">
                            <p className="text-xs text-muted-foreground">{format(new Date(data.date), 'MMM d, yyyy')}</p>
                            <p className="text-sm font-medium text-foreground">
                              Skin: {skinLabels[idx]} ({data.skinScore.toFixed(1)}/5)
                            </p>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine y={3} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <Line
                      type="monotone"
                      dataKey="skinScore"
                      stroke={lineColor}
                      strokeWidth={2}
                      dot={{ fill: lineColor, strokeWidth: 0, r: 3 }}
                      activeDot={{ r: 5, fill: lineColor }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {flarePeriods.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded bg-red-500/40" />
                <span>Shaded areas indicate active flare periods</span>
              </div>
            )}

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

export default SkinProgressInsights;
