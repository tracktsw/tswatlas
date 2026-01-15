import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CheckCircle, BarChart3, Users, BookOpen, Settings, Calendar as CalendarIcon, Flame, Pencil, Leaf, Sun, Loader2, Crown, Sparkles, Trophy } from 'lucide-react';
import { LeafIllustration, PlantIllustration } from '@/components/illustrations';
import compassLogo from '@/assets/compass-logo.png';
import { useUserData } from '@/contexts/UserDataContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useTopTreatments } from '@/hooks/useTopTreatments';
import { format, differenceInDays, parseISO, subDays, startOfDay } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const HomePage = () => {
  const { photos, checkIns, journalEntries, tswStartDate, setTswStartDate, isLoading, isSyncing, refreshPhotos } = useUserData();
  const { isPremium, isLoading: isSubscriptionLoading } = useSubscription();
  const { data: topTreatments, isLoading: isLoadingTreatments } = useTopTreatments(3);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    tswStartDate ? parseISO(tswStartDate) : undefined
  );
  
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayCheckIns = checkIns.filter((c) => format(new Date(c.timestamp), 'yyyy-MM-dd') === today);
  const hasMorningCheckIn = todayCheckIns.some((c) => c.timeOfDay === 'morning');
  const hasEveningCheckIn = todayCheckIns.some((c) => c.timeOfDay === 'evening');

  const daysSinceTsw = tswStartDate 
    ? differenceInDays(new Date(), parseISO(tswStartDate)) 
    : null;

  // Calculate check-in streak
  const calculateStreak = () => {
    if (checkIns.length === 0) return 0;
    
    const checkInDays = new Set(
      checkIns.map(c => format(new Date(c.timestamp), 'yyyy-MM-dd'))
    );
    
    let streak = 0;
    let currentDate = startOfDay(new Date());
    
    const todayStr = format(currentDate, 'yyyy-MM-dd');
    if (!checkInDays.has(todayStr)) {
      currentDate = subDays(currentDate, 1);
    }
    
    while (checkInDays.has(format(currentDate, 'yyyy-MM-dd'))) {
      streak++;
      currentDate = subDays(currentDate, 1);
    }
    
    return streak;
  };

  const checkInStreak = calculateStreak();

  const handleSaveDate = () => {
    if (selectedDate) {
      setTswStartDate(format(selectedDate, 'yyyy-MM-dd'));
      setIsDatePickerOpen(false);
    }
  };

  /**
   * iOS PWA lifecycle handling:
   * When the app returns from background (or another page), refresh photos.
   * This ensures the homepage always shows the latest data without a manual refresh.
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Silently refresh photos when page becomes visible
        refreshPhotos();
      }
    };

    // Listen for visibility changes (iOS PWA returning from background)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also refresh on focus (handles some edge cases)
    window.addEventListener('focus', refreshPhotos);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', refreshPhotos);
    };
  }, [refreshPhotos]);

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good morning', icon: Sun };
    if (hour < 17) return { text: 'Good afternoon', icon: Leaf };
    return { text: 'Good evening', icon: Leaf };
  };

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  const quickActions = [
    { 
      path: '/photos', 
      icon: Camera, 
      label: 'Take Photo', 
      description: 'Capture your progress',
      bgClass: 'bg-action/10',
      iconColor: 'text-action',
      isAction: true
    },
    { 
      path: '/check-in', 
      icon: CheckCircle, 
      label: 'Check In', 
      description: todayCheckIns.length >= 1 ? 'All done today!' : 'Log your day',
      bgClass: 'bg-action/10',
      iconColor: 'text-action',
      isAction: true
    },
    { 
      path: '/insights', 
      icon: BarChart3, 
      label: 'View Insights', 
      description: 'See your progress',
      bgClass: 'bg-sage/10',
      iconColor: 'text-sage'
    },
    { 
      path: '/community', 
      icon: Users, 
      label: 'Community', 
      description: 'What helps others',
      bgClass: 'bg-healing/10',
      iconColor: 'text-healing'
    },
  ];

  // OPTIMIZED: Removed full-page loading spinner
  // Page now renders progressively - skeleton sections handle individual loading states
  // This provides a much faster perceived load time

  return (
    <div className="px-4 md:px-8 lg:px-12 py-6 space-y-6 max-w-lg md:max-w-none mx-auto relative">
      {/* Sync indicator */}
      {isSyncing && (
        <div className="fixed top-4 right-4 bg-sage/10 text-sage text-xs px-3 py-1.5 rounded-full flex items-center gap-2 z-50">
          <Loader2 className="w-3 h-3 animate-spin" />
          Syncing...
        </div>
      )}
      
      {/* Subtle decorative elements */}
      <div className="decorative-blob w-40 h-40 bg-sage/20 -top-10 -right-10 fixed" />
      <div className="decorative-blob w-48 h-48 bg-healing/15 bottom-40 -left-20 fixed" />
      
      {/* Subtle leaf motif */}
      <LeafIllustration variant="branch" className="w-20 h-16 fixed top-20 right-2 opacity-20 pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={compassLogo} alt="TrackTSW" className="w-12 h-12 rounded-2xl shadow-sm" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <GreetingIcon className="w-4 h-4 text-sage" />
              <span className="text-xs font-medium text-muted-foreground">{greeting.text}</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-anchor">
              TrackTSW
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Premium Badge */}
          {!isSubscriptionLoading && isPremium && (
            <div className="flex flex-col items-center gap-0.5">
              <div className="p-1.5 rounded-xl bg-primary/10">
                <Crown className="w-4 h-4 text-primary" />
              </div>
              <span className="text-[9px] font-semibold text-primary">Premium</span>
            </div>
          )}
          <Link 
            to="/settings" 
            className="p-2.5 rounded-2xl bg-muted/60 hover:bg-muted transition-colors"
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
          </Link>
        </div>
      </div>

      {/* TSW Journey Tracker - Progress Card */}
      <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
        <div className="progress-card p-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {daysSinceTsw !== null ? (
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-anchor/10">
                <Flame className="w-7 h-7 text-anchor" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-anchor">{daysSinceTsw}</span>
                  <span className="text-sm font-semibold text-foreground">days healing</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-medium">
                  Started: {format(parseISO(tswStartDate!), 'MMMM d, yyyy')}
                </p>
              </div>
              <DialogTrigger asChild>
                <button 
                  className="p-2.5 rounded-xl bg-muted/60 hover:bg-muted transition-colors"
                  onClick={() => setSelectedDate(parseISO(tswStartDate!))}
                >
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </button>
              </DialogTrigger>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-sage/10">
                <CalendarIcon className="w-6 h-6 text-sage" />
              </div>
              <div className="flex-1">
                <h2 className="font-display font-bold text-lg text-anchor">Track Your TSW Journey</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Set the date you stopped steroids to track your healing progress.
                </p>
                <DialogTrigger asChild>
                  <Button variant="action" size="sm" className="mt-3">
                    Set Start Date
                  </Button>
                </DialogTrigger>
              </div>
            </div>
          )}
        </div>
        
        <DialogContent className="max-w-[340px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-anchor">When did you stop steroids?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date > new Date()}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
            <Button onClick={handleSaveDate} disabled={!selectedDate} className="w-full" variant="action">
              Save Date
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Today's Status - Progressive loading with skeleton */}
      <div className="glass-card-elevated p-5 md:p-6 animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <h3 className="font-display font-bold text-lg md:text-xl text-anchor mb-4">Today's Status</h3>
        <div className="grid grid-cols-4 gap-2 md:gap-4">
          <div className="text-center p-3 rounded-2xl bg-muted/50">
            {isLoading ? (
              <Skeleton className="h-8 w-8 mx-auto mb-1" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{photos.length}</p>
            )}
            <p className="text-xs text-muted-foreground font-medium mt-1">Photos</p>
          </div>
          <div className="text-center p-3 rounded-2xl bg-sage/8">
            {isLoading ? (
              <Skeleton className="h-8 w-10 mx-auto mb-1" />
            ) : (
              <p className="text-2xl font-bold text-sage">{todayCheckIns.length}/1</p>
            )}
            <p className="text-xs text-muted-foreground font-medium mt-1">Check-ins</p>
          </div>
          <div className="text-center p-3 rounded-2xl bg-muted/50">
            {isLoading ? (
              <Skeleton className="h-8 w-8 mx-auto mb-1" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{journalEntries.length}</p>
            )}
            <p className="text-xs text-muted-foreground font-medium mt-1">Journal</p>
          </div>
          <div className="text-center p-3 rounded-2xl bg-streak/8">
            {isLoading ? (
              <Skeleton className="h-8 w-8 mx-auto mb-1" />
            ) : (
              <p className="text-2xl font-bold text-streak">{checkInStreak}</p>
            )}
            <p className="text-xs text-muted-foreground font-medium mt-1">Streak</p>
          </div>
        </div>
      </div>

      {/* Community Favorites */}
      <div className="glass-card p-5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-coral" />
            <h3 className="font-display font-bold text-lg text-anchor">Community Favorites</h3>
          </div>
          <Link to="/community" className="text-xs text-sage font-medium hover:underline">
            View all →
          </Link>
        </div>
        
        {isLoadingTreatments ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4 mb-1" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : topTreatments && topTreatments.length > 0 ? (
          <div className="space-y-3">
            {topTreatments.map((treatment, index) => {
              const rankColors = [
                'bg-amber-400/20 text-amber-600', // Gold
                'bg-slate-300/30 text-slate-500', // Silver
                'bg-amber-600/20 text-amber-700', // Bronze
              ];
              const rankEmoji = ['🥇', '🥈', '🥉'];
              
              return (
                <div key={treatment.id} className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold",
                    rankColors[index]
                  )}>
                    {rankEmoji[index]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{treatment.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">{treatment.category}</span>
                      <span>•</span>
                      <span className="text-sage font-medium">{treatment.helpfulPercentage}% helpful</span>
                      <span>•</span>
                      <span>{treatment.totalVotes} votes</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No community votes yet.</p>
            <Link to="/community" className="text-sm text-sage font-medium hover:underline mt-1 inline-block">
              Be the first to vote →
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.25s' }}>
        <h3 className="font-display font-bold text-lg md:text-xl text-anchor">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {quickActions.map(({ path, icon: Icon, label, description, bgClass, iconColor, isAction }, index) => (
            <Link
              key={path}
              to={path}
              className={cn(
                "glass-card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",
                isAction && "border-action/20"
              )}
              style={{ animationDelay: `${0.3 + index * 0.05}s` }}
            >
              <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center mb-3", bgClass)}>
                <Icon className={cn("w-5 h-5", iconColor)} />
              </div>
              <h4 className="font-display font-bold text-foreground text-sm">{label}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Journal Quick Access */}
      <Link 
        to="/journal" 
        className="glass-card p-5 flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 animate-slide-up"
        style={{ animationDelay: '0.35s' }}
      >
        <div className="w-12 h-12 rounded-xl bg-sage/10 flex items-center justify-center">
          <BookOpen className="w-6 h-6 text-sage" />
        </div>
        <div className="flex-1">
          <h4 className="font-display font-bold text-foreground">Journal</h4>
          <p className="text-sm text-muted-foreground">Write about your journey</p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center">
          <span className="text-muted-foreground text-sm">→</span>
        </div>
      </Link>
    </div>
  );
};

export default HomePage;
