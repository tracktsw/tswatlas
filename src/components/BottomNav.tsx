import { NavLink, useLocation } from 'react-router-dom';
import { Home, Camera, CheckCircle, BarChart3, Users, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/photos', icon: Camera, label: 'Photos' },
  { path: '/check-in', icon: CheckCircle, label: 'Check-in' },
  { path: '/insights', icon: BarChart3, label: 'Insights' },
  { path: '/community', icon: Users, label: 'Community' },
  { path: '/coach', icon: Sparkles, label: 'Coach' },
];

const BottomNav = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-gradient-to-t from-card via-card to-card/95 backdrop-blur-md border-t border-border/60 shadow-warm-lg">
        <div className="flex items-center justify-around px-2 py-2.5 max-w-lg mx-auto">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            return (
              <NavLink
                key={path}
                to={path}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300',
                  isActive
                    ? 'text-coral bg-coral/10 shadow-warm-sm scale-105'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:scale-102'
                )}
              >
                <div className={cn(
                  'p-1.5 rounded-xl transition-all duration-300',
                  isActive && 'bg-coral/15'
                )}>
                  <Icon className={cn(
                    'w-5 h-5 transition-all duration-300',
                    isActive && 'animate-scale-in'
                  )} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={cn(
                  "text-[10px] font-semibold transition-all duration-300",
                  isActive && "text-coral"
                )}>{label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
