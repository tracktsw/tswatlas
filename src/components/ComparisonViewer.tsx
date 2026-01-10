import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Image, Columns, Rows } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { VirtualPhoto } from '@/hooks/useVirtualizedPhotos';
import { parseLocalDateTime } from '@/utils/localDateTime';
import { useLayout } from '@/contexts/LayoutContext';
import { usePlatform } from '@/hooks/usePlatform';

interface ComparisonViewerProps {
  photos: VirtualPhoto[];
  onExit: () => void;
}

// Preload images in background
const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
};

// Pinch-to-zoom image component
const ZoomableImage = ({
  thumbnailSrc,
  mediumSrc,
  alt,
  onTap,
  priority = false,
}: {
  thumbnailSrc?: string;
  mediumSrc?: string;
  alt: string;
  onTap: () => void;
  priority?: boolean;
}) => {
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [mediumLoaded, setMediumLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchPosition = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasThumb = typeof thumbnailSrc === "string" && thumbnailSrc.length > 0;
  const hasMedium = typeof mediumSrc === "string" && mediumSrc.length > 0;

  // Preload medium image once thumbnail loads
  useEffect(() => {
    if (thumbLoaded && hasMedium) {
      preloadImage(mediumSrc);
    }
  }, [thumbLoaded, hasMedium, mediumSrc]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1 && scale > 1) {
      // Pan start
      setIsDragging(true);
      lastTouchPosition.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  }, [scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      // Pinch zoom
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = distance / lastTouchDistance.current;
      setScale(prev => Math.min(Math.max(prev * delta, 1), 4));
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1 && isDragging && lastTouchPosition.current && scale > 1) {
      // Pan
      const deltaX = e.touches[0].clientX - lastTouchPosition.current.x;
      const deltaY = e.touches[0].clientY - lastTouchPosition.current.y;
      setPosition(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
      lastTouchPosition.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  }, [isDragging, scale]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    lastTouchDistance.current = null;
    setIsDragging(false);
    lastTouchPosition.current = null;
    
    // Reset position if scale is back to 1
    if (scale <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);

  const handleClick = useCallback(() => {
    if (scale === 1) {
      onTap();
    } else {
      // Reset zoom on tap when zoomed
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [scale, onTap]);

  // Memoize transform style
  const transformStyle = useMemo(() => ({
    transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
    willChange: scale > 1 ? 'transform' : 'auto',
  }), [scale, position.x, position.y]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      {!thumbLoaded && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50 animate-pulse" />
      )}

      {hasThumb && (
        <img
          src={thumbnailSrc}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setThumbLoaded(true)}
          onError={() => setHasError(true)}
          className={cn(
            "max-w-full max-h-full object-contain transition-all duration-200",
            thumbLoaded ? "opacity-100" : "opacity-0",
            mediumLoaded ? "opacity-0 absolute" : "",
            scale > 1 && "blur-sm"
          )}
          style={transformStyle}
        />
      )}

      {hasMedium && thumbLoaded && (
        <img
          src={mediumSrc}
          alt={alt}
          loading="eager"
          decoding="async"
          onLoad={() => setMediumLoaded(true)}
          onError={() => setHasError(true)}
          className={cn(
            "max-w-full max-h-full object-contain transition-opacity duration-300",
            mediumLoaded ? "opacity-100" : "opacity-0 absolute"
          )}
          style={transformStyle}
        />
      )}

      {hasError && (
        <div className="flex items-center justify-center">
          <Image className="w-12 h-12 text-muted-foreground/50" />
        </div>
      )}
      
      {scale > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded-full">
          {Math.round(scale * 100)}%
        </div>
      )}
    </div>
  );
};

// Fullscreen single image viewer with swipe
const FullscreenViewer = ({
  photos,
  initialIndex,
  onClose,
  isAndroid,
}: {
  photos: VirtualPhoto[];
  initialIndex: number;
  onClose: () => void;
  isAndroid: boolean;
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const photo = photos[currentIndex];

  // Preload adjacent images
  useEffect(() => {
    if (currentIndex > 0 && photos[currentIndex - 1].mediumUrl) {
      preloadImage(photos[currentIndex - 1].mediumUrl);
    }
    if (currentIndex < photos.length - 1 && photos[currentIndex + 1].mediumUrl) {
      preloadImage(photos[currentIndex + 1].mediumUrl);
    }
  }, [currentIndex, photos]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < photos.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else if (diff < 0 && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    }
    
    touchStartX.current = null;
  }, [currentIndex, photos.length]);

  // Memoize date formatting
  const formattedDate = useMemo(() => 
    format(parseLocalDateTime(photo.timestamp) || new Date(photo.timestamp), 'MMM d, yyyy'),
    [photo.timestamp]
  );

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex flex-col"
      style={isAndroid ? undefined : { 
        paddingTop: 'var(--safe-top)',
        paddingBottom: 'var(--safe-bottom)',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-sm"
        style={isAndroid ? undefined : { 
          marginTop: 'calc(max(env(safe-area-inset-top, 44px), constant(safe-area-inset-top, 44px)) + var(--ios-header-extra, 16px))' 
        }}
      >
        <div className="flex items-center gap-1">
          <span className="text-sm text-white/80">{formattedDate}</span>
          {!photo.takenAt && (
            <span className="text-xs text-white/50">(uploaded)</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-3 rounded-full hover:bg-white/10 transition-colors min-w-11 min-h-11 flex items-center justify-center"
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center">
        <ZoomableImage
          thumbnailSrc={photo.thumbnailUrl}
          mediumSrc={photo.mediumUrl}
          alt={`Photo ${currentIndex + 1}`}
          onTap={onClose}
          priority
        />
      </div>

      {/* Navigation indicators */}
      <div className="flex items-center justify-center gap-2 py-4 bg-black/50">
        {photos.map((_, idx) => (
          <div
            key={idx}
            className={cn(
              "w-2 h-2 rounded-full transition-all",
              idx === currentIndex ? "bg-white w-4" : "bg-white/40"
            )}
          />
        ))}
      </div>

      {/* Navigation arrows (desktop) */}
      {currentIndex > 0 && (
        <button
          onClick={() => setCurrentIndex(prev => prev - 1)}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors hidden sm:block"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
      )}
      {currentIndex < photos.length - 1 && (
        <button
          onClick={() => setCurrentIndex(prev => prev + 1)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors hidden sm:block"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      )}
    </div>
  );
};

export const ComparisonViewer = ({ photos, onExit }: ComparisonViewerProps) => {
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const isMobile = useIsMobile();
  const { setHideBottomNav } = useLayout();
  const { isAndroid } = usePlatform();
  const hasUserToggled = useRef(false);
  const [isStacked, setIsStacked] = useState(isMobile);

  // Preload both comparison images immediately
  useEffect(() => {
    if (photos.length === 2) {
      photos.forEach(photo => {
        if (photo.mediumUrl) {
          preloadImage(photo.mediumUrl);
        }
      });
    }
  }, [photos]);

  // Hide bottom nav
  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  // Sync layout with screen size
  useEffect(() => {
    if (!hasUserToggled.current) {
      setIsStacked(isMobile);
    }
  }, [isMobile]);

  const handleLayoutToggle = useCallback(() => {
    hasUserToggled.current = true;
    setIsStacked(prev => !prev);
  }, []);

  // Lock body scroll
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    const scrollY = window.scrollY;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Memoize formatted dates
  const formattedDates = useMemo(() => 
    photos.map(photo => 
      format(parseLocalDateTime(photo.timestamp) || new Date(photo.timestamp), 'MMM d, yyyy')
    ),
    [photos]
  );

  if (photos.length !== 2) return null;

  return (
    <>
      {/* Comparison view */}
      <div 
        className="fixed inset-0 z-40 bg-background flex flex-col overscroll-none"
        style={isAndroid ? { height: '100dvh' } : { 
          height: '100dvh',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-background/95 backdrop-blur-sm border-b border-border/30">
          <span className="text-sm font-medium text-muted-foreground">Comparing</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLayoutToggle}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              title={isStacked ? "Side by side" : "Stacked"}
            >
              {isStacked ? (
                <Columns className="w-4 h-4" />
              ) : (
                <Rows className="w-4 h-4" />
              )}
              <span className="hidden sm:inline text-xs">
                {isStacked ? "Side by side" : "Stacked"}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onExit}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
              Exit
            </Button>
          </div>
        </div>

        {/* Comparison grid */}
        <div 
          className={cn(
            "flex-1 gap-1 p-1 min-h-0",
            isStacked 
              ? "flex flex-col overflow-y-auto overscroll-contain" 
              : "grid grid-cols-2"
          )}
          style={isStacked ? { WebkitOverflowScrolling: 'touch' } : undefined}
        >
          {photos.map((photo, idx) => (
            <div 
              key={photo.id} 
              className={cn(
                "relative flex flex-col",
                isStacked 
                  ? "w-full flex-shrink-0" 
                  : "min-h-0 flex-1"
              )}
            >
              {/* Image container */}
              <div className={cn(
                "relative bg-muted/30 rounded-lg overflow-hidden",
                isStacked 
                  ? "w-full max-h-[42vh]"
                  : "flex-1 min-h-0"
              )}>
                <ZoomableImage
                  thumbnailSrc={photo.thumbnailUrl}
                  mediumSrc={photo.mediumUrl}
                  alt={`Comparison ${idx + 1}`}
                  onTap={() => setFullscreenIndex(idx)}
                  priority={idx === 0}
                />
              </div>
              {/* Date label */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-foreground/90 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                <span>{formattedDates[idx]}</span>
                {!photo.takenAt && (
                  <span className="text-[10px] opacity-70">(uploaded)</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Hint text */}
        <div className="text-center py-2 text-xs text-muted-foreground">
          Tap image to expand • Pinch to zoom
        </div>
      </div>

      {/* Fullscreen viewer */}
      {fullscreenIndex !== null && (
        <FullscreenViewer
          photos={photos}
          initialIndex={fullscreenIndex}
          onClose={() => setFullscreenIndex(null)}
          isAndroid={isAndroid}
        />
      )}
    </>
  );
};