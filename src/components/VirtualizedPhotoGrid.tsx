import { useRef, useEffect, useState, useCallback, memo } from 'react';
import { Image, Check, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { VirtualPhoto } from '@/hooks/useVirtualizedPhotos';
import { parseLocalDateTime } from '@/utils/localDateTime';

// Limit concurrent image loads on mobile
const MAX_CONCURRENT_LOADS = typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent) ? 4 : 8;

interface PhotoItemProps {
  photo: VirtualPhoto;
  isSelected: boolean;
  compareMode: boolean;
  priority: boolean;
  onSelect: (photo: VirtualPhoto) => void;
  bodyPartLabel: string;
  onLoad?: () => void;
}

// Memoized photo item to prevent unnecessary re-renders
const PhotoItem = memo(({ 
  photo, 
  isSelected, 
  compareMode, 
  priority, 
  onSelect, 
  bodyPartLabel,
  onLoad 
}: PhotoItemProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(priority);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection observer for lazy loading with prefetch margin
  useEffect(() => {
    if (priority) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '600px', // Prefetch images 600px before they appear
        threshold: 0,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const isOptimistic = photo.isOptimistic === true;

  return (
    <div
      ref={imgRef}
      className={cn(
        'glass-card overflow-hidden group relative cursor-pointer transition-all duration-300 hover:shadow-warm hover:-translate-y-1',
        compareMode && isSelected && 'ring-2 ring-coral shadow-glow-coral',
        compareMode && 'hover:opacity-90',
        isOptimistic && 'ring-2 ring-coral/60 animate-pulse'
      )}
      onClick={() => !isOptimistic && onSelect(photo)}
    >
      {/* Fixed aspect ratio container with blur placeholder */}
      <div className="relative w-full aspect-square bg-muted overflow-hidden">
        {/* Blur placeholder - shows immediately */}
        {!isLoaded && !hasError && !isOptimistic && (
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-background/10 to-transparent animate-shimmer" />
          </div>
        )}

        {/* Actual thumbnail image - only render if we have a URL */}
        {isVisible && photo.thumbnailUrl && (
          <img
            src={photo.thumbnailUrl}
            alt={`${photo.bodyPart} photo`}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            onLoad={handleLoad}
            onError={() => setHasError(true)}
            className={cn(
              'w-full h-full object-cover transition-opacity duration-500',
              isLoaded ? 'opacity-100' : 'opacity-0',
              isOptimistic && 'blur-[2px] scale-105'
            )}
          />
        )}

        {/* Optimistic upload overlay */}
        {isOptimistic && (
          <div className="absolute inset-0 bg-background/30 flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-coral/90 flex items-center justify-center shadow-lg">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
            <span className="text-xs font-medium text-foreground bg-background/80 px-2 py-1 rounded-full">
              Uploading...
            </span>
          </div>
        )}

        {/* Error state */}
        {hasError && !isOptimistic && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <Image className="w-8 h-8 text-muted-foreground/50" />
          </div>
        )}

        {/* Selection indicator for compare mode */}
        {compareMode && isSelected && !isOptimistic && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-coral rounded-full flex items-center justify-center shadow-md">
            <Check className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Photo info */}
      <div className="p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold bg-coral/10 text-coral px-2.5 py-1 rounded-full">
            {bodyPartLabel}
          </span>
          <div className="text-right">
            <span className="text-xs text-muted-foreground">
              {format(parseLocalDateTime(photo.timestamp) || new Date(photo.timestamp), 'MMM d, yyyy')}
            </span>
            {/* Show indicator if using upload date (no EXIF) */}
            {!photo.takenAt && (
              <span className="block text-[10px] text-muted-foreground/60 italic">
                uploaded
              </span>
            )}
          </div>
        </div>
        {photo.notes && (
          <p className="text-xs text-muted-foreground line-clamp-1">{photo.notes}</p>
        )}
      </div>
    </div>
  );
});

PhotoItem.displayName = 'PhotoItem';

interface VirtualizedPhotoGridProps {
  photos: VirtualPhoto[];
  selectedPhotos: VirtualPhoto[];
  compareMode: boolean;
  onPhotoSelect: (photo: VirtualPhoto) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  bodyParts: { value: string; label: string }[];
}

export const VirtualizedPhotoGrid = ({
  photos,
  selectedPhotos,
  compareMode,
  onPhotoSelect,
  onLoadMore,
  hasMore,
  bodyParts,
}: VirtualizedPhotoGridProps) => {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadingCountRef = useRef(0);
  const pendingLoadsRef = useRef<(() => void)[]>([]);

  // Handle concurrent load limiting
  const handleImageLoad = useCallback(() => {
    loadingCountRef.current--;
    if (pendingLoadsRef.current.length > 0 && loadingCountRef.current < MAX_CONCURRENT_LOADS) {
      const next = pendingLoadsRef.current.shift();
      next?.();
      loadingCountRef.current++;
    }
  }, []);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      {
        rootMargin: '200px',
        threshold: 0,
      }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  const getBodyPartLabel = useCallback((bodyPart: string) => {
    return bodyParts.find(b => b.value === bodyPart)?.label || bodyPart;
  }, [bodyParts]);

  return (
    <div className="grid grid-cols-2 gap-4">
      {photos.map((photo, index) => {
        const isSelected = selectedPhotos.some(p => p.id === photo.id);
        
        return (
          <PhotoItem
            key={photo.id}
            photo={photo}
            isSelected={isSelected}
            compareMode={compareMode}
            priority={index < 4}
            onSelect={onPhotoSelect}
            bodyPartLabel={getBodyPartLabel(photo.bodyPart)}
            onLoad={handleImageLoad}
          />
        );
      })}
      
      {/* Infinite scroll trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="col-span-2 h-20 flex items-center justify-center">
          <div className="grid grid-cols-2 gap-4 w-full">
            {[0, 1].map(i => (
              <div key={i} className="glass-card overflow-hidden">
                <div className="w-full aspect-square bg-muted animate-pulse">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-background/10 to-transparent animate-shimmer" />
                </div>
                <div className="p-3">
                  <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
