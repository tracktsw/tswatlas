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

/**
 * BottomNav - Fixed bottom navigation bar
 * 
 * Safe area handling:
 * - iOS: Uses CSS env(safe-area-inset-bottom) via --safe-bottom variable
 * - Android: Uses --android-safe-bottom set by AndroidSafeAreaContext from @capacitor-community/safe-area plugin
 * - Web: No padding needed
 * 
 * Platform detection determines which CSS variable to use.
 */
const BottomNav = () => {
  const location = useLocation();
  
  // Detect Android platform
  const isAndroid = /android/i.test(navigator.userAgent);
  
  // Use platform-specific CSS variable
  const bottomPadding = isAndroid 
    ? 'var(--android-safe-bottom, 0px)' 
    : 'var(--safe-bottom, 0px)';

  return (
    <nav 
      className="fixed left-0 right-0 bottom-0 z-50"
      style={{ paddingBottom: bottomPadding }}
    >
      {/* Background layer - extends below nav to fill the safe area */}
      <div 
        className="absolute inset-0 bg-card/98 backdrop-blur-md border-t border-border/50"
        style={{ 
          bottom: isAndroid ? 'calc(-1 * var(--android-safe-bottom, 0px))' : '0' 
        }}
      />
      <div className="relative flex items-center justify-around px-1 py-2.5 max-w-lg mx-auto shadow-lg">
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
              <div
                className={cn(
                  'p-1.5 rounded-xl transition-all duration-200',
                  isActive && 'bg-anchor/10'
                )}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-semibold whitespace-nowrap">{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
