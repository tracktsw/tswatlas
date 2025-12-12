import { Link } from 'react-router-dom';
import { Camera, CheckCircle, BarChart3, Users, BookOpen, Settings, Sparkles } from 'lucide-react';
import { useLocalStorage } from '@/contexts/LocalStorageContext';
import { format } from 'date-fns';

const HomePage = () => {
  const { photos, checkIns, journalEntries } = useLocalStorage();
  
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayCheckIns = checkIns.filter(c => c.timestamp.startsWith(today));
  const hasMorningCheckIn = todayCheckIns.some(c => c.timeOfDay === 'morning');
  const hasEveningCheckIn = todayCheckIns.some(c => c.timeOfDay === 'evening');

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
            TSW Tracker
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

      {/* Encouragement Card */}
      <div className="glass-card p-4 warm-gradient">
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
