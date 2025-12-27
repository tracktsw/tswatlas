import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CheckCircle, BarChart3, Users, BookOpen, Settings, Calendar as CalendarIcon, Flame, Pencil, Leaf, Sun, Loader2 } from 'lucide-react';
import { LeafIllustration, PlantIllustration } from '@/components/illustrations';
import compassLogo from '@/assets/compass-logo.png';
import { useUserData } from '@/contexts/UserDataContext';
import { format, differenceInDays, parseISO, subDays, startOfDay } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const HomePage = () => {
  const { photos, checkIns, journalEntries, tswStartDate, setTswStartDate, isLoading, isSyncing, refreshPhotos } = useUserData();
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
      description: hasMorningCheckIn && hasEveningCheckIn ? 'All done today!' : 'Log your day',
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

  if (isLoading) {
    return (
      <div className="px-4 py-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-sage" />
          <p className="text-muted-foreground">Loading your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6 max-w-lg mx-auto relative">
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
        <Link 
          to="/settings" 
          className="p-2.5 rounded-2xl bg-muted/60 hover:bg-muted transition-colors"
        >
          <Settings className="w-5 h-5 text-muted-foreground" />
        </Link>
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

      {/* Encouragement Card - grounded, not playful */}
      <div className="glass-card p-5 animate-slide-up relative overflow-hidden" style={{ animationDelay: '0.15s' }}>
        <div className="decorative-dots absolute inset-0 opacity-30" />
        <div className="flex items-start gap-4 relative">
          <div className="p-3 rounded-2xl bg-sage/10">
            <Leaf className="w-6 h-6 text-sage" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-foreground">One day at a time</h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Healing is not linear. Your body is working to restore itself, and every small step matters.
            </p>
          </div>
        </div>
      </div>

      {/* Today's Status */}
      <div className="glass-card-elevated p-5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <h3 className="font-display font-bold text-lg text-anchor mb-4">Today's Status</h3>
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-3 rounded-2xl bg-muted/50">
            <p className="text-2xl font-bold text-foreground">{photos.length}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">Photos</p>
          </div>
          <div className="text-center p-3 rounded-2xl bg-sage/8">
            <p className="text-2xl font-bold text-sage">{todayCheckIns.length}/2</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">Check-ins</p>
          </div>
          <div className="text-center p-3 rounded-2xl bg-muted/50">
            <p className="text-2xl font-bold text-foreground">{journalEntries.length}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">Journal</p>
          </div>
          <div className="text-center p-3 rounded-2xl bg-streak/8">
            <div className="flex items-center justify-center gap-1">
              <p className="text-2xl font-bold text-streak">{checkInStreak}</p>
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-1">Streak</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.25s' }}>
        <h3 className="font-display font-bold text-lg text-anchor">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
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
