import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CheckCircle, BarChart3, Users, BookOpen, Settings, Sparkles, Calendar as CalendarIcon, Flame, Pencil } from 'lucide-react';
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

  const quickActions = [
    { 
      path: '/photos', 
      icon: Camera, 
      label: 'Take Photo', 
      description: 'Capture your progress',
      color: 'bg-primary/10 text-primary'
    },
    { 
      path: '/check-in', 
      icon: CheckCircle, 
      label: 'Check In', 
      description: hasMorningCheckIn && hasEveningCheckIn ? 'All done today!' : 'Log your day',
      color: 'bg-accent/20 text-accent-foreground'
    },
    { 
      path: '/insights', 
      icon: BarChart3, 
      label: 'View Insights', 
      description: 'See your progress',
      color: 'bg-secondary text-secondary-foreground'
    },
    { 
      path: '/community', 
      icon: Users, 
      label: 'Community', 
      description: 'What helps others',
      color: 'bg-coral/20 text-foreground'
    },
  ];

  return (
    <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            TSW Atlas
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your healing journey, one day at a time
          </p>
        </div>
        <Link 
          to="/settings" 
          className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
        >
          <Settings className="w-5 h-5 text-muted-foreground" />
        </Link>
      </div>

      {/* TSW Journey Tracker */}
      <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
        <div className="glass-card p-4 warm-gradient">
          {daysSinceTsw !== null ? (
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/20">
                <Flame className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-primary">{daysSinceTsw}</span>
                  <span className="text-sm font-medium text-foreground">days healing</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Started: {format(parseISO(tswStartDate!), 'MMMM d, yyyy')}
                </p>
              </div>
              <DialogTrigger asChild>
                <button 
                  className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                  onClick={() => setSelectedDate(parseISO(tswStartDate!))}
                >
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </button>
              </DialogTrigger>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/20">
                <CalendarIcon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-foreground">Track Your TSW Journey</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Set the date you stopped steroids to track your healing progress.
                </p>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="sm" className="mt-2">
                    Set Start Date
                  </Button>
                </DialogTrigger>
              </div>
            </div>
          )}
        </div>
        
        <DialogContent className="max-w-[340px]">
          <DialogHeader>
            <DialogTitle>When did you stop steroids?</DialogTitle>
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
            <Button onClick={handleSaveDate} disabled={!selectedDate} className="w-full">
              Save Date
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Encouragement Card */}
      <div className="glass-card p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/20">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">You're doing great!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Every day of healing counts. Remember, TSW is temporary and your skin will heal.
            </p>
          </div>
        </div>
      </div>

      {/* Today's Status */}
      <div className="glass-card p-4">
        <h3 className="font-display font-semibold text-foreground mb-3">Today's Status</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-xl bg-muted/50">
            <p className="text-2xl font-bold text-primary">{photos.length}</p>
            <p className="text-xs text-muted-foreground">Photos</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-muted/50">
            <p className="text-2xl font-bold text-primary">{todayCheckIns.length}/2</p>
            <p className="text-xs text-muted-foreground">Check-ins</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-muted/50">
            <p className="text-2xl font-bold text-primary">{journalEntries.length}</p>
            <p className="text-xs text-muted-foreground">Journal</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h3 className="font-display font-semibold text-foreground">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map(({ path, icon: Icon, label, description, color }) => (
            <Link
              key={path}
              to={path}
              className="glass-card p-4 hover:shadow-soft transition-all duration-200 group"
            >
              <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                <Icon className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-foreground text-sm">{label}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Journal Quick Access */}
      <Link to="/journal" className="glass-card p-4 flex items-center gap-4 hover:shadow-soft transition-all">
        <div className="w-12 h-12 rounded-xl bg-sage-light flex items-center justify-center">
          <BookOpen className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-foreground">Journal</h4>
          <p className="text-sm text-muted-foreground">Write about your journey</p>
        </div>
      </Link>
    </div>
  );
};

export default HomePage;
