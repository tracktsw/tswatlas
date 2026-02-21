import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { CheckIn } from '@/contexts/UserDataContext';
import { format, subDays, startOfDay, startOfWeek, endOfWeek, eachWeekOfInterval, eachDayOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
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

  // Group data by the same granularity as severity trends
  const skinData = useMemo(() => {
    const now = new Date();

    if (timeRange === '7') {
      // Daily granularity – label like severity trends: "EEE" (Mon, Tue…)
      const startDate = subDays(startOfDay(now), 6);
      const days = eachDayOfInterval({ start: startDate, end: now });
      return days
        .map(day => {
          const dayStart = startOfDay(day);
          const dayEnd = new Date(dayStart);
          dayEnd.setHours(23, 59, 59, 999);
          const dayCheckIns = filteredCheckIns.filter(c => {
            const d = new Date(c.timestamp);
            return isWithinInterval(d, { start: dayStart, end: dayEnd });
          });
          if (dayCheckIns.length === 0) return null;
          const avg = dayCheckIns.reduce((s, c) => s + c.skinFeeling, 0) / dayCheckIns.length;
          return { label: format(day, 'EEE'), skinScore: avg, dateRaw: format(day, 'yyyy-MM-dd') };
        })
        .filter((d): d is NonNullable<typeof d> => Boolean(d));
    } else if (timeRange === '30') {
      // Weekly granularity – label: "MMM d"
      const startDate = startOfWeek(subDays(now, 29), { weekStartsOn: 0 });
      const weeks = eachWeekOfInterval({ start: startDate, end: now }, { weekStartsOn: 0 });
      return weeks
        .map(weekStart => {
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
          const weekCheckIns = filteredCheckIns.filter(c => {
            const d = new Date(c.timestamp);
            return isWithinInterval(d, { start: weekStart, end: weekEnd });
          });
          if (weekCheckIns.length === 0) return null;
          const avg = weekCheckIns.reduce((s, c) => s + c.skinFeeling, 0) / weekCheckIns.length;
          return { label: format(weekStart, 'MMM d'), skinScore: avg, dateRaw: format(weekStart, 'yyyy-MM-dd') };
        })
        .filter((w): w is NonNullable<typeof w> => Boolean(w));
    } else {
      // Monthly granularity – label: "MMM yy"
      if (filteredCheckIns.length === 0) return [];
      const oldest = filteredCheckIns.reduce((min, c) => {
        const d = new Date(c.timestamp);
        return d < min ? d : min;
      }, new Date());
      const startDate = startOfMonth(oldest);
      const months = eachMonthOfInterval({ start: startDate, end: now });
      return months
        .map(monthStart => {
          const monthEnd = endOfMonth(monthStart);
          const monthCheckIns = filteredCheckIns.filter(c => {
            const d = new Date(c.timestamp);
            return isWithinInterval(d, { start: monthStart, end: monthEnd });
          });
          if (monthCheckIns.length === 0) return null;
          const avg = monthCheckIns.reduce((s, c) => s + c.skinFeeling, 0) / monthCheckIns.length;
          return { label: format(monthStart, 'MMM yy'), skinScore: avg, dateRaw: format(monthStart, 'yyyy-MM-dd') };
        })
        .filter((m): m is NonNullable<typeof m> => Boolean(m));
    }
  }, [filteredCheckIns, timeRange]);

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
      const fs = flareStateByDate.get(entry.dateRaw);
      const isFlaring = fs?.isInFlareEpisode || fs?.flareState === 'active_flare' || fs?.flareState === 'early_flare';
      if (isFlaring) {
        if (!current) current = { start: entry.label, end: entry.label };
        else current.end = entry.label;
      } else if (current) {
        periods.push(current);
        current = null;
      }
    });
    if (current) periods.push(current);
    return periods;
  }, [skinData, flareStateByDate]);

  // Use labels as chart dataKey
  const chartData = useMemo(() => {
    return skinData.map(entry => ({
      label: entry.label,
      skinScore: entry.skinScore,
      dateRaw: entry.dateRaw,
    }));
  }, [skinData]);

  const needsScroll = timeRange === 'all' && chartData.length > 12;

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
            {needsScroll ? (
              <div className="flex w-full">
                {/* Fixed Y-axis */}
                <div className="h-48 flex-shrink-0" style={{ width: 40 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[{ label: '', skinScore: 1 }, { label: ' ', skinScore: 5 }]} margin={{ top: 10, right: 0, left: 0, bottom: 18 }}>
                      <YAxis
                        domain={[1, 5]}
                        ticks={[1, 2, 3, 4, 5]}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        width={30}
                        tickFormatter={value => skinEmojis[value - 1] || ''}
                      />
                      <XAxis dataKey="label" hide />
                      <Line dataKey="skinScore" hide />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {/* Scrollable chart area */}
                <div className="flex-1 overflow-x-auto pb-2">
                  <div className="h-48" style={{ minWidth: `${Math.max(chartData.length * 70, 300)}px` }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                        {flarePeriods.map((period, idx) => (
                          <ReferenceArea key={idx} x1={period.start} x2={period.end} y1={1} y2={5} fill="#ef4444" fillOpacity={0.25} />
                        ))}
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          tickLine={false}
                          interval={0}
                        />
                        <YAxis domain={[1, 5]} hide />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const data = payload[0].payload;
                            const idx = Math.round(data.skinScore) - 1;
                            return (
                              <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg">
                                <p className="text-xs text-muted-foreground">{data.label}</p>
                                <p className="text-sm font-medium text-foreground">
                                  Skin: {skinLabels[idx]} ({data.skinScore.toFixed(1)}/5)
                                </p>
                              </div>
                            );
                          }}
                        />
                        <ReferenceLine y={3} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                        <Line type="monotone" dataKey="skinScore" stroke={lineColor} strokeWidth={2} dot={{ fill: lineColor, strokeWidth: 0, r: 3 }} activeDot={{ r: 5, fill: lineColor }} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[9px] text-muted-foreground/60 text-center mt-1">
                    ← Scroll to see all {chartData.length} months →
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    {flarePeriods.map((period, idx) => (
                      <ReferenceArea key={idx} x1={period.start} x2={period.end} y1={1} y2={5} fill="#ef4444" fillOpacity={0.25} />
                    ))}
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={false}
                      interval={0}
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
                            <p className="text-xs text-muted-foreground">{data.label}</p>
                            <p className="text-sm font-medium text-foreground">
                              Skin: {skinLabels[idx]} ({data.skinScore.toFixed(1)}/5)
                            </p>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine y={3} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="skinScore" stroke={lineColor} strokeWidth={2} dot={{ fill: lineColor, strokeWidth: 0, r: 3 }} activeDot={{ r: 5, fill: lineColor }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

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
