import { useMemo, useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
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

// Map paths to lazy import functions for preloading
const pageImports: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/HomePage'),
  '/photos': () => import('@/pages/PhotoDiaryPage'),
  '/check-in': () => import('@/pages/CheckInPage'),
  '/insights': () => import('@/pages/InsightsPage'),
  '/community': () => import('@/pages/CommunityPage'),
  '/coach': () => import('@/pages/CoachPage'),
};

const BottomNav = () => {
  const location = useLocation();
  const platform = Capacitor.getPlatform();
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({ x: 0, width: 0 });
  const preloadedRoutes = useRef<Set<string>>(new Set());

  const activeIndex = useMemo(() => {
    const index = navItems.findIndex(item => item.path === location.pathname);
    return index >= 0 ? index : 0;
  }, [location.pathname]);

  // Calculate indicator position based on ACTUAL element positions
  const updateIndicator = () => {
    const activeItem = itemRefs.current[activeIndex];
    if (!activeItem || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();

    setIndicatorStyle({
      x: itemRect.left - containerRect.left,
      width: itemRect.width,
    });
  };

  useLayoutEffect(() => {
    updateIndicator();
  }, [activeIndex]);

  useEffect(() => {
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeIndex]);

  // Preload route on hover for faster navigation
  const handleMouseEnter = useCallback((path: string) => {
    if (preloadedRoutes.current.has(path)) return;
    
    const importFn = pageImports[path];
    if (importFn) {
      preloadedRoutes.current.add(path);
      importFn();
    }
  }, []);

  // Preload on touch start for mobile
  const handleTouchStart = useCallback((path: string) => {
    handleMouseEnter(path);
  }, [handleMouseEnter]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-card/98 backdrop-blur-md border-t border-border/50 shadow-lg">
        <div 
          ref={containerRef}
        className={cn(
          "flex items-center justify-around px-1 max-w-lg md:max-w-none md:px-8 lg:px-12 mx-auto relative",
          platform === 'ios' ? "py-2.5 md:py-3" : "py-3"
        )}
        >
          {/* Sliding indicator - Pure CSS for 60fps */}
          <div
            className="absolute top-1/2 h-[44px] bg-anchor/8 rounded-2xl pointer-events-none transition-all duration-300 ease-out"
            style={{
              transform: `translate3d(${indicatorStyle.x}px, -50%, 0)`,
              width: `${indicatorStyle.width}px`,
              willChange: 'transform, width',
            }}
          />

          {navItems.map(({ path, icon: Icon, label }, index) => {
            const isActive = location.pathname === path;
            return (
              <NavLink
                key={path}
                to={path}
                ref={(el) => (itemRefs.current[index] = el)}
                onMouseEnter={() => handleMouseEnter(path)}
                onTouchStart={() => handleTouchStart(path)}
                className={cn(
                  'flex flex-col items-center gap-1 min-w-[56px] md:min-w-[72px] px-2 md:px-3 py-2 rounded-2xl transition-colors duration-200 z-10',
                  isActive
                    ? 'text-anchor'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div className={cn(
                  'p-1.5 md:p-2 rounded-xl transition-all duration-200',
                  isActive && 'bg-anchor/10'
                )}>
                  <Icon className="w-5 h-5 md:w-6 md:h-6" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className="text-[10px] md:text-xs font-semibold whitespace-nowrap">{label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;