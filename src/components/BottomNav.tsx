import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Camera, CheckCircle, BarChart3, Users, Leaf } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
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
  const platform = Capacitor.getPlatform();

  const activeIndex = useMemo(() => {
    const index = navItems.findIndex(item => item.path === location.pathname);
    return index >= 0 ? index : 0;
  }, [location.pathname]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-card/98 backdrop-blur-md border-t border-border/50 shadow-lg">
        <div className={cn(
          "flex items-center justify-around px-1 max-w-lg mx-auto relative",
          platform === 'ios' ? "py-2.5" : "py-3"
        )}>
          {/* Sliding indicator */}
          <div
            className="absolute top-1/2 h-[44px] bg-anchor/8 rounded-2xl pointer-events-none"
            style={{
              width: `calc((100% - 8px) / ${navItems.length})`,
              transform: `translateX(calc(${activeIndex} * 100%)) translateY(-50%)`,
              left: '4px',
              transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />

          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            return (
              <NavLink
                key={path}
                to={path}
                className={cn(
                  'flex flex-col items-center gap-1 min-w-[56px] px-2 py-2 rounded-2xl transition-colors duration-200 z-10',
                  isActive
                    ? 'text-anchor'
                    : 'text-muted-foreground hover:text-foreground'
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