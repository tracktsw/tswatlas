import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CheckCircle, BarChart3, Users, BookOpen, Settings, Sparkles, Calendar as CalendarIcon, Flame, Pencil, Heart, Sun } from 'lucide-react';
import tswAtlasLogo from '@/assets/tsw-atlas-logo.png';
import { useLocalStorage } from '@/contexts/LocalStorageContext';
import { format, differenceInDays, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const HomePage = () => {
  const { photos, checkIns, journalEntries, tswStartDate, setTswStartDate } = useLocalStorage();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    tswStartDate ? parseISO(tswStartDate) : undefined
  );
  
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayCheckIns = checkIns.filter(c => c.timestamp.startsWith(today));
  const hasMorningCheckIn = todayCheckIns.some(c => c.timeOfDay === 'morning');
  const hasEveningCheckIn = todayCheckIns.some(c => c.timeOfDay === 'evening');

  const daysSinceTsw = tswStartDate 
    ? differenceInDays(new Date(), parseISO(tswStartDate)) 
    : null;

  const handleSaveDate = () => {
    if (selectedDate) {
      setTswStartDate(format(selectedDate, 'yyyy-MM-dd'));
      setIsDatePickerOpen(false);
    }
  };

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good morning', icon: Sun };
    if (hour < 17) return { text: 'Good afternoon', icon: Heart };
    return { text: 'Good evening', icon: Sparkles };
  };

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  const quickActions = [
    { 
      path: '/photos', 
      icon: Camera, 
      label: 'Take Photo', 
      description: 'Capture your progress',
      gradient: 'from-coral/20 to-coral-light',
      iconColor: 'text-coral'
    },
    { 
      path: '/check-in', 
      icon: CheckCircle, 
      label: 'Check In', 
      description: hasMorningCheckIn && hasEveningCheckIn ? 'All done today!' : 'Log your day',
      gradient: 'from-primary/20 to-sage-light',
      iconColor: 'text-primary'
    },
    { 
      path: '/insights', 
      icon: BarChart3, 
      label: 'View Insights', 
      description: 'See your progress',
      gradient: 'from-honey/20 to-cream-dark',
      iconColor: 'text-honey'
    },
    { 
      path: '/community', 
      icon: Users, 
      label: 'Community', 
      description: 'What helps others',
      gradient: 'from-terracotta/20 to-coral-light/50',
      iconColor: 'text-terracotta'
    },
  ];

  return (
    <div className="px-4 py-6 space-y-6 max-w-lg mx-auto relative">
      {/* Decorative background elements */}
      <div className="decorative-blob w-32 h-32 bg-coral/30 -top-10 -right-10 fixed" />
      <div className="decorative-blob w-40 h-40 bg-sage/20 bottom-40 -left-20 fixed" />
      
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={tswAtlasLogo} alt="TSW Atlas" className="w-12 h-12 rounded-2xl shadow-warm" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-coral rounded-full border-2 border-background animate-pulse-soft" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <GreetingIcon className="w-4 h-4 text-coral" />
              <span className="text-xs font-medium text-coral">{greeting.text}</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground text-warm-shadow">
              TSW Atlas
            </h1>
          </div>
        </div>
        <Link 
          to="/settings" 
          className="p-2.5 rounded-2xl bg-muted/80 hover:bg-muted hover:shadow-warm transition-all duration-300 group"
        >
          <Settings className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>
      </div>

      {/* TSW Journey Tracker */}
      <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
        <div className="glass-card-warm p-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {daysSinceTsw !== null ? (
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-coral/20 to-coral-light shadow-warm-sm">
                <Flame className="w-7 h-7 text-coral" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-coral text-warm-shadow">{daysSinceTsw}</span>
                  <span className="text-sm font-semibold text-foreground">days healing</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-medium">
                  Started: {format(parseISO(tswStartDate!), 'MMMM d, yyyy')}
                </p>
              </div>
              <DialogTrigger asChild>
                <button 
                  className="p-2.5 rounded-xl bg-muted/80 hover:bg-muted hover:shadow-warm-sm transition-all duration-300"
                  onClick={() => setSelectedDate(parseISO(tswStartDate!))}
                >
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </button>
              </DialogTrigger>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-sage-light shadow-warm-sm">
                <CalendarIcon className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-display font-bold text-lg text-foreground">Track Your TSW Journey</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Set the date you stopped steroids to track your healing progress.
                </p>
                <DialogTrigger asChild>
                  <Button variant="warm" size="sm" className="mt-3">
                    Set Start Date
                  </Button>
                </DialogTrigger>
              </div>
            </div>
          )}
        </div>
        
        <DialogContent className="max-w-[340px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">When did you stop steroids?</DialogTitle>
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
            <Button onClick={handleSaveDate} disabled={!selectedDate} className="w-full" variant="warm">
              Save Date
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Encouragement Card */}
      <div className="glass-card p-5 animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-sage-light shadow-warm-sm animate-float">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-foreground">You're doing great!</h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Every day of healing counts. Remember, TSW is temporary and your skin will heal.
            </p>
          </div>
        </div>
      </div>

      {/* Today's Status */}
      <div className="glass-card p-5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <h3 className="font-display font-bold text-lg text-foreground mb-4">Today's Status</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-coral/10 to-coral-light/50 shadow-warm-sm">
            <p className="text-3xl font-bold text-coral">{photos.length}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">Photos</p>
          </div>
          <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-sage-light/50 shadow-warm-sm">
            <p className="text-3xl font-bold text-primary">{todayCheckIns.length}/2</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">Check-ins</p>
          </div>
          <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-honey/10 to-cream-dark/50 shadow-warm-sm">
            <p className="text-3xl font-bold text-honey">{journalEntries.length}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">Journal</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.25s' }}>
        <h3 className="font-display font-bold text-lg text-foreground">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-4">
          {quickActions.map(({ path, icon: Icon, label, description, gradient, iconColor }, index) => (
            <Link
              key={path}
              to={path}
              className="glass-card p-5 hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-300 group"
              style={{ animationDelay: `${0.3 + index * 0.05}s` }}
            >
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-warm-sm`}>
                <Icon className={`w-6 h-6 ${iconColor}`} />
              </div>
              <h4 className="font-display font-bold text-foreground">{label}</h4>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Journal Quick Access */}
      <Link 
        to="/journal" 
        className="glass-card-warm p-5 flex items-center gap-4 hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-300 animate-slide-up"
        style={{ animationDelay: '0.35s' }}
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-sage-light flex items-center justify-center shadow-warm-sm">
          <BookOpen className="w-7 h-7 text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="font-display font-bold text-lg text-foreground">Journal</h4>
          <p className="text-sm text-muted-foreground">Write about your journey</p>
        </div>
        <div className="w-8 h-8 rounded-xl bg-muted/80 flex items-center justify-center">
          <span className="text-muted-foreground">→</span>
        </div>
      </Link>
    </div>
  );
};

export default HomePage;
