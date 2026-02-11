import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Camera, CheckCircle, BarChart3, Users, Building2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/photos', icon: Camera, label: 'Photos' },
  { path: '/check-in', icon: CheckCircle, label: 'Check-in' },
  { path: '/insights', icon: BarChart3, label: 'Insights' },
  { path: '/community', icon: Users, label: 'Community' },
  { path: '/practitioners', icon: Building2, label: 'Directory' },
];

const pageImports: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/HomePage'),
  '/photos': () => import('@/pages/PhotoDiaryPage'),
  '/check-in': () => import('@/pages/CheckInPage'),
  '/insights': () => import('@/pages/InsightsPage'),
  '/community': () => import('@/pages/CommunityPage'),
  '/practitioners': () => import('@/pages/PractitionerDirectoryPage'),
};

const BottomNav = () => {
  const location = useLocation();
  const platform = Capacitor.getPlatform();
  const isAndroid = platform === 'android';
  const { impact } = useHapticFeedback();

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({ x: 0, width: 0 });
  const preloadedRoutes = useRef<Set<string>>(new Set());
  
  // Haptic feedback on nav tap
  const handleNavTap = useCallback(() => {
    impact('light');
  }, [impact]);

  const activeIndex = useMemo(() => {
    const index = navItems.findIndex((item) => item.path === location.pathname);
    return index >= 0 ? index : 0;
  }, [location.pathname]);

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

  useEffect(() => {
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const handlePreload = (path: string) => {
    if (preloadedRoutes.current.has(path)) return;
    const importFn = pageImports[path];
    if (!importFn) return;

    preloadedRoutes.current.add(path);
    importFn();
  };

  // Keep your existing safe-area usage.
  // On Android we DO NOT need "extend/fixed" tricks anymore because the nav is in-flow.
  const paddingBottom =
    platform === 'ios'
      ? 'max(calc(var(--safe-bottom, 0px) - 8px), 0px)'
      : 'var(--safe-bottom, 0px)';

  return (
    <nav
      className={cn(
        // iOS: unchanged (fixed)
        !isAndroid && 'fixed bottom-0 left-0 right-0 z-50',
        // Android: in-flow at bottom of flex layout
        isAndroid && 'relative shrink-0',

        'bg-card/98 backdrop-blur-md border-t border-border/50 shadow-lg'
      )}
      style={{
        paddingBottom,
        paddingLeft: 'var(--safe-area-inset-left, 0px)',
        paddingRight: 'var(--safe-area-inset-right, 0px)',
        ...(isAndroid ? { backgroundColor: 'hsl(var(--card) / 0.98)' } : {}),
      }}
    >
      <div
        ref={containerRef}
        className={cn(
          'flex items-center justify-around px-1 max-w-lg md:max-w-none md:px-8 lg:px-12 mx-auto relative',
          platform === 'ios' ? 'py-1' : 'py-1 sm:py-1.5'
        )}
      >
        <div
          className="absolute top-1/2 h-[32px] bg-anchor/8 rounded-2xl pointer-events-none transition-all duration-200 ease-out"
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
              onMouseEnter={() => handlePreload(path)}
              onTouchStart={() => handlePreload(path)}
              onClick={handleNavTap}
              className={cn(
                platform === 'ios'
                  ? 'flex flex-col items-center gap-0.5 min-w-[56px] md:min-w-[72px] px-2 md:px-3 py-1 rounded-2xl transition-colors duration-150 z-10 touch-manipulation active:scale-[0.96]'
                  : 'flex flex-col items-center gap-0.5 min-w-[56px] md:min-w-[72px] px-2 md:px-3 py-1.5 sm:py-2 rounded-2xl transition-colors duration-150 z-10 touch-manipulation active:scale-[0.96]',
                isActive ? 'text-anchor' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div
                className={cn(
                  platform === 'ios'
                    ? 'p-1 rounded-xl transition-all duration-150'
                    : 'p-1 sm:p-1.5 md:p-2 rounded-xl transition-all duration-150',
                  isActive && 'bg-anchor/10'
                )}
              >
                <Icon className="w-5 h-5 md:w-6 md:h-6" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="text-[10px] md:text-xs font-semibold whitespace-nowrap">
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
