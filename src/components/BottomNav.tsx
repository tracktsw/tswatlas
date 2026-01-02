import { NavLink, useLocation } from 'react-router-dom';
import { Home, Camera, CheckCircle, BarChart3, Users, Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/photos', icon: Camera, label: 'Photos' },
  { path: '/check-in', icon: CheckCircle, label: 'Check-in' },
  { path: '/insights', icon: BarChart3, label: 'Insights' },
  { path: '/community', icon: Users, label: 'Community' },
  { path: '/coach', icon: Leaf, label: 'Coach' },
];

const BottomNav = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-card/98 backdrop-blur-md border-t border-border/50 shadow-lg">
        <div className="flex items-center justify-around px-1 py-2.5 max-w-lg mx-auto">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            return (
              <NavLink
                key={path}
                to={path}
                className={cn(
                  'flex flex-col items-center gap-1 min-w-[56px] px-2 py-2 rounded-2xl transition-all duration-200',
                  isActive
                    ? 'text-anchor bg-anchor/8'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <div className={cn(
                  'p-1.5 rounded-xl transition-all duration-200',
                  isActive && 'bg-anchor/10'
                )}>
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className="text-[10px] font-semibold whitespace-nowrap">{label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
