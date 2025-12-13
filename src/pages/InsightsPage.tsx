import { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, Calendar, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocalStorage, BodyPart } from '@/contexts/LocalStorageContext';
import { format, subDays, startOfDay, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, isSameMonth, addMonths, subMonths, getDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

const moodEmojis = ['😢', '😕', '😐', '🙂', '😊'];
const skinEmojis = ['🔴', '🟠', '🟡', '🟢', '💚'];

const treatments = [
  { id: 'nmt', label: 'NMT' },
  { id: 'moisturizer', label: 'Moisturizer' },
  { id: 'rlt', label: 'Red Light' },
  { id: 'salt_bath', label: 'Salt Bath' },
  { id: 'cold_compress', label: 'Cold Compress' },
  { id: 'antihistamine', label: 'Antihistamine' },
  { id: 'exercise', label: 'Exercise' },
  { id: 'meditation', label: 'Meditation' },
];

const bodyParts: { value: BodyPart; label: string; emoji: string }[] = [
  { value: 'face', label: 'Face', emoji: '😊' },
  { value: 'neck', label: 'Neck', emoji: '🦒' },
  { value: 'arms', label: 'Arms', emoji: '💪' },
  { value: 'hands', label: 'Hands', emoji: '🤲' },
  { value: 'legs', label: 'Legs', emoji: '🦵' },
  { value: 'feet', label: 'Feet', emoji: '🦶' },
  { value: 'torso', label: 'Torso', emoji: '👕' },
  { value: 'back', label: 'Back', emoji: '🔙' },
];

const InsightsPage = () => {
  const { checkIns, photos } = useLocalStorage();
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const last7Days = useMemo(() => {
    const end = startOfDay(new Date());
    const start = subDays(end, 6);
    return eachDayOfInterval({ start, end });
  }, []);

  const weeklyData = useMemo(() => {
    return last7Days.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayCheckIns = checkIns.filter(c => c.timestamp.startsWith(dateStr));
      const avgMood = dayCheckIns.length 
        ? dayCheckIns.reduce((sum, c) => sum + c.mood, 0) / dayCheckIns.length 
        : 0;
      const avgSkin = dayCheckIns.length 
        ? dayCheckIns.reduce((sum, c) => sum + c.skinFeeling, 0) / dayCheckIns.length 
        : 0;
      
      return {
        date,
        dateStr,
        checkIns: dayCheckIns.length,
        avgMood,
        avgSkin,
      };
    });
  }, [checkIns, last7Days]);

  const treatmentStats = useMemo(() => {
    const stats: Record<string, { count: number; goodDays: number }> = {};
    
    // Collect all treatments from check-ins (including custom ones)
    checkIns.forEach(checkIn => {
      checkIn.treatments.forEach(t => {
        if (!stats[t]) {
          stats[t] = { count: 0, goodDays: 0 };
        }
        stats[t].count++;
        if (checkIn.skinFeeling >= 4) {
          stats[t].goodDays++;
        }
      });
    });
    
    return Object.entries(stats)
      .filter(([_, data]) => data.count > 0)
      .map(([id, data]) => ({
        id,
        label: treatments.find(t => t.id === id)?.label || id,
        count: data.count,
        effectiveness: data.count > 0 ? Math.round((data.goodDays / data.count) * 100) : 0,
      }))
      .sort((a, b) => b.effectiveness - a.effectiveness);
  }, [checkIns]);

  const photosByBodyPart = useMemo(() => {
    const counts: Record<BodyPart, number> = {
      face: 0, neck: 0, arms: 0, hands: 0, legs: 0, feet: 0, torso: 0, back: 0
    };
    photos.forEach(p => {
      counts[p.bodyPart]++;
    });
    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [photos]);

  const overallTrend = useMemo(() => {
    if (checkIns.length < 2) return null;
    const sorted = [...checkIns].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
    
    const firstAvg = firstHalf.reduce((s, c) => s + c.skinFeeling, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, c) => s + c.skinFeeling, 0) / secondHalf.length;
    
    return secondAvg > firstAvg ? 'improving' : secondAvg < firstAvg ? 'declining' : 'stable';
  }, [checkIns]);

  // Calendar data
  const calendarDays = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    const days = eachDayOfInterval({ start, end });
    
    // Add padding for first week
    const startPadding = getDay(start);
    const paddedDays: (Date | null)[] = Array(startPadding).fill(null);
    
    return [...paddedDays, ...days];
  }, [calendarMonth]);

  const getCheckInsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return checkIns.filter(c => c.timestamp.startsWith(dateStr));
  };

  const getPhotosForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return photos.filter(p => p.timestamp.startsWith(dateStr));
  };

  const selectedDayCheckIns = selectedDate ? getCheckInsForDate(selectedDate) : [];
  const selectedDayPhotos = selectedDate ? getPhotosForDate(selectedDate) : [];

  if (checkIns.length === 0) {
    return (
      <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Insights</h1>
          <p className="text-sm text-muted-foreground">Track your healing patterns</p>
        </div>
        <div className="glass-card p-8 text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No data yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Start doing daily check-ins to see your insights
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Insights</h1>
        <p className="text-sm text-muted-foreground">Your healing patterns</p>
      </div>
      {/* Overall Trend */}
      {overallTrend && (
        <div className={cn(
          'glass-card p-4',
          overallTrend === 'improving' && 'warm-gradient'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center',
              overallTrend === 'improving' ? 'bg-primary/20' : 'bg-muted'
            )}>
              <TrendingUp className={cn(
                'w-5 h-5',
                overallTrend === 'improving' ? 'text-primary' : 'text-muted-foreground',
                overallTrend === 'declining' && 'rotate-180'
              )} />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {overallTrend === 'improving' ? 'Skin is improving!' : 
                 overallTrend === 'declining' ? 'Skin may be flaring' : 
                 'Skin is stable'}
              </p>
              <p className="text-sm text-muted-foreground">
                Based on your recent check-ins
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Overview */}
      <div className="space-y-3">
        <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Last 7 Days
        </h3>
        <div className="glass-card p-4">
          <div className="flex justify-between gap-1">
            {weeklyData.map(({ date, avgMood, avgSkin, checkIns: count }) => (
              <div key={date.toISOString()} className="flex-1 text-center">
                <p className="text-xs text-muted-foreground mb-2">
                  {format(date, 'EEE')}
                </p>
                <div className={cn(
                  'aspect-square rounded-lg flex items-center justify-center text-lg mb-1',
                  count > 0 ? 'bg-primary/10' : 'bg-muted/50'
                )}>
                  {count > 0 ? skinEmojis[Math.round(avgSkin) - 1] || '—' : '—'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {count > 0 ? moodEmojis[Math.round(avgMood) - 1] : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Treatment Effectiveness */}
      {treatmentStats.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
            <Heart className="w-4 h-4" />
            What's Helping You
          </h3>
          <div className="glass-card p-4 space-y-3">
            {treatmentStats.map(({ id, label, count, effectiveness }) => (
              <div key={id} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground">
                    {effectiveness}% good days ({count} uses)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${effectiveness}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar Button */}
      <Dialog open={!!selectedDate || calendarOpen} onOpenChange={(open) => {
        if (!open) {
          setSelectedDate(null);
          setCalendarOpen(false);
        }
      }}>
        <Button 
          variant="outline" 
          className="w-full flex items-center justify-center gap-2"
          onClick={() => setCalendarOpen(true)}
        >
          <Calendar className="w-4 h-4" />
          View History Calendar
        </Button>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'History Calendar'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedDate ? (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)} className="mb-2">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back to calendar
              </Button>
              {selectedDayCheckIns.length > 0 ? (
                selectedDayCheckIns.map((checkIn, idx) => (
                  <div key={idx} className="p-3 bg-muted/50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(checkIn.timestamp), 'h:mm a')}
                      </span>
                      <div className="flex gap-2">
                        <span title="Mood">{moodEmojis[checkIn.mood - 1]}</span>
                        <span title="Skin">{skinEmojis[checkIn.skinFeeling - 1]}</span>
                      </div>
                    </div>
                    {checkIn.treatments.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {checkIn.treatments.map(t => (
                          <Badge key={t} variant="secondary" className="text-xs">
                            {treatments.find(tr => tr.id === t)?.label || t}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {checkIn.notes && (
                      <p className="text-sm text-muted-foreground italic">"{checkIn.notes}"</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center">No check-ins this day</p>
              )}
              
              {selectedDayPhotos.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Photos ({selectedDayPhotos.length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedDayPhotos.map((photo, idx) => (
                      <div key={idx} className="aspect-square rounded-lg overflow-hidden">
                        <img 
                          src={photo.dataUrl} 
                          alt={photo.bodyPart}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Month Navigation */}
              <div className="flex items-center justify-between">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setCalendarMonth(prev => subMonths(prev, 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="font-medium">{format(calendarMonth, 'MMMM yyyy')}</span>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setCalendarMonth(prev => addMonths(prev, 1))}
                  disabled={isSameMonth(calendarMonth, new Date())}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Day Labels */}
              <div className="grid grid-cols-7 gap-1">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                  <div key={day} className="text-center text-xs text-muted-foreground font-medium">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((date, idx) => {
                  if (!date) {
                    return <div key={`empty-${idx}`} className="aspect-square" />;
                  }
                  
                  const dayCheckIns = getCheckInsForDate(date);
                  const dayPhotos = getPhotosForDate(date);
                  const hasData = dayCheckIns.length > 0 || dayPhotos.length > 0;
                  const isToday = isSameDay(date, new Date());
                  const avgSkin = dayCheckIns.length 
                    ? Math.round(dayCheckIns.reduce((sum, c) => sum + c.skinFeeling, 0) / dayCheckIns.length)
                    : 0;
                  
                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => hasData && setSelectedDate(date)}
                      disabled={!hasData}
                      className={cn(
                        'aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-colors relative',
                        hasData ? 'hover:bg-primary/20 cursor-pointer' : 'cursor-default',
                        isToday && 'ring-2 ring-primary',
                        hasData && 'bg-primary/10'
                      )}
                    >
                      <span className={cn(
                        'font-medium',
                        hasData ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {format(date, 'd')}
                      </span>
                      {hasData && avgSkin > 0 && (
                        <span className="text-[10px] leading-none">{skinEmojis[avgSkin - 1]}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stats Summary */}
      <div className="glass-card p-4">
        <h3 className="font-display font-semibold text-foreground mb-3">Summary</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-xl">
            <p className="text-2xl font-bold text-primary">{checkIns.length}</p>
            <p className="text-xs text-muted-foreground">Total Check-ins</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-xl">
            <p className="text-2xl font-bold text-primary">{photos.length}</p>
            <p className="text-xs text-muted-foreground">Photos Taken</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsightsPage;
