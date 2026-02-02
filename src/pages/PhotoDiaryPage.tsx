import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Camera, Plus, Trash2, Image, Sparkles, Lock, Crown, X, ImagePlus, CalendarIcon, ArrowUpDown, ArrowDown, ArrowUp, Loader2, RotateCcw, RefreshCw } from 'lucide-react';
import { useUserData, BodyPart, Photo } from '@/contexts/UserDataContext';
import { useVirtualizedPhotos, VirtualPhoto, SortOrder, BodyPart as VBodyPart } from '@/hooks/useVirtualizedPhotos';
import { VirtualizedPhotoGrid } from '@/components/VirtualizedPhotoGrid';
import { ComparisonViewer } from '@/components/ComparisonViewer';
import { BatchUploadModal } from '@/components/BatchUploadModal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogContentFullscreen, DialogDescription, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { format, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { parseLocalDateTime } from '@/utils/localDateTime';
import { useSubscription } from '@/hooks/useSubscription';
import { usePaymentRouter } from '@/hooks/usePaymentRouter';
import { getTermsUrl, PRIVACY_POLICY_URL, type Platform } from '@/utils/platformLinks';
import { useBatchUpload } from '@/hooks/useBatchUpload';
import { useSingleUpload } from '@/hooks/useSingleUpload';
import { extractExifDateWithSource } from '@/utils/exifExtractor';
import { supabase } from '@/integrations/supabase/client';
import { LeafIllustration, SparkleIllustration } from '@/components/illustrations';
import { SparkleEffect } from '@/components/SparkleEffect';
import { PhotoSkeleton } from '@/components/PhotoSkeleton';
import { PhotoDiaryPageSkeleton } from '@/components/skeletons/PageSkeletons';

// Preload image utility with priority hints - UNIVERSAL (iOS, Android, Web)
const preloadImage = (src: string, priority: 'high' | 'low' = 'low'): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Try to use link preload for better browser prioritization
    if (typeof document !== 'undefined' && priority === 'high') {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      link.fetchPriority = 'high';
      document.head.appendChild(link);
    }
    
    const img = new window.Image();
    img.decoding = 'async';
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
};

// Optimized progressive image component with PINCH ZOOM - UNIVERSAL
const ModalImage = ({
  thumbnailSrc,
  highResSrc,
  alt,
  priority = false,
}: {
  thumbnailSrc?: string;
  highResSrc?: string;
  alt: string;
  priority?: boolean;
}) => {
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [highResLoaded, setHighResLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  // Pinch zoom state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchPosition = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasThumb = typeof thumbnailSrc === "string" && thumbnailSrc.length > 0;
  const hasHighRes = typeof highResSrc === "string" && highResSrc.length > 0;

  // Preload high-res IMMEDIATELY (don't wait for thumbnail - like ComparisonViewer)
  useEffect(() => {
    if (!hasHighRes) return;
    
    let cancelled = false;
    // Use high priority for images in modal - user is actively viewing
    preloadImage(highResSrc, 'high')
      .then(() => {
        if (!cancelled) setHighResLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setHasError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [hasHighRes, highResSrc]);

  const handleThumbLoad = useCallback(() => {
    setThumbLoaded(true);
  }, []);

  const handleThumbError = useCallback(() => {
    setHasError(true);
  }, []);

  const handleHighResLoad = useCallback(() => {
    setHighResLoaded(true);
  }, []);

  const handleHighResError = useCallback(() => {
    setHasError(true);
  }, []);

  // PINCH ZOOM: Touch handlers - UNIVERSAL (works on all platforms)
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
      setIsPanning(true);
      lastTouchPosition.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  }, [scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      // Pinch zoom
      e.preventDefault(); // Prevent page zoom
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = distance / lastTouchDistance.current;
      setScale(prev => Math.min(Math.max(prev * delta, 1), 4));
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1 && isPanning && lastTouchPosition.current && scale > 1) {
      // Pan
      e.preventDefault();
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
  }, [isPanning, scale]);

  const handleTouchEnd = useCallback(() => {
    lastTouchDistance.current = null;
    setIsPanning(false);
    lastTouchPosition.current = null;
    
    // Reset position if scale is back to 1
    if (scale <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);

  const handleDoubleClick = useCallback(() => {
    if (scale === 1) {
      setScale(2);
    } else {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);

  // Memoize transform style - GPU accelerated with translate3d (like ComparisonViewer)
  const transformStyle = useMemo(() => ({
    transform: `translate3d(${position.x / scale}px, ${position.y / scale}px, 0) scale(${scale})`,
    transformOrigin: 'center center',
    willChange: scale > 1 ? 'transform' : 'auto',
    transition: isPanning ? 'none' : 'transform 0.2s ease-out',
  }), [scale, position.x, position.y, isPanning]);

  // Memoize image classes
  const thumbClasses = useMemo(() => cn(
    "max-w-full max-h-[70dvh] object-contain select-none",
    thumbLoaded ? "opacity-100" : "opacity-0",
    highResLoaded ? "opacity-0 absolute" : ""
  ), [thumbLoaded, highResLoaded]);

  const highResClasses = useMemo(() => cn(
    "max-w-full max-h-[70dvh] object-contain select-none",
    highResLoaded ? "opacity-100" : "opacity-0 absolute"
  ), [highResLoaded]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center touch-none select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: scale > 1 ? 'move' : 'zoom-in' }}
    >
      {/* Loading shimmer - only show if nothing loaded yet */}
      {!thumbLoaded && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50 animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-background/10 to-transparent animate-shimmer" />
        </div>
      )}

      {/* Thumbnail - only show when high-res not loaded */}
      {hasThumb && !highResLoaded && (
        <img
          src={thumbnailSrc}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={handleThumbLoad}
          onError={handleThumbError}
          className={cn(
            "max-w-full max-h-[70dvh] object-contain select-none transition-all duration-200",
            thumbLoaded ? "opacity-100" : "opacity-0",
            // Blur when zoomed and high-res not ready
            scale > 1 && !highResLoaded && "blur-sm opacity-50"
          )}
          style={transformStyle}
          draggable={false}
        />
      )}

      {/* Loading spinner - shows over thumbnail while high-res loads */}
      {hasHighRes && !highResLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-background/80 backdrop-blur-sm rounded-full p-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </div>
      )}

      {/* High-res image - main viewing quality */}
      {hasHighRes && (
        <img
          src={highResSrc}
          alt={alt}
          loading="eager"
          decoding="async"
          onLoad={handleHighResLoad}
          onError={handleHighResError}
          className={cn(
            "max-w-full max-h-[70dvh] object-contain select-none",
            highResLoaded ? "opacity-100 transition-opacity duration-300" : "opacity-0 absolute"
          )}
          style={transformStyle}
          draggable={false}
        />
      )}

      {/* Fallback if no high-res - show thumb at full quality */}
      {!hasHighRes && hasThumb && thumbLoaded && (
        <img
          src={thumbnailSrc}
          alt={alt}
          className="max-w-full max-h-[70dvh] object-contain select-none"
          style={transformStyle}
          draggable={false}
        />
      )}

      {hasError && (
        <div className="flex items-center justify-center p-8">
          <Image className="w-12 h-12 text-muted-foreground/50" />
        </div>
      )}
      
      {/* Loading indicator when zooming before high-res ready */}
      {scale > 1 && !highResLoaded && hasHighRes && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 pointer-events-none">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-xs text-foreground">Loading high quality...</span>
        </div>
      )}
      
      {/* Zoom percentage indicator (only when high-res loaded) */}
      {scale > 1 && highResLoaded && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-white bg-black/60 px-3 py-1.5 rounded-full pointer-events-none">
          {Math.round(scale * 100)}%
        </div>
      )}
      
      {/* Zoom hint (when not zoomed) */}
      {scale === 1 && thumbLoaded && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-background/80 px-3 py-1.5 rounded-full pointer-events-none opacity-50">
          Pinch to zoom • Double tap
        </div>
      )}
    </div>
  );
};



const bodyParts: { value: BodyPart; label: string }[] = [
  { value: 'face', label: 'Face' },
  { value: 'neck', label: 'Neck' },
  { value: 'arms', label: 'Arms' },
  { value: 'hands', label: 'Hands' },
  { value: 'legs', label: 'Legs' },
  { value: 'feet', label: 'Feet' },
  { value: 'torso', label: 'Torso' },
  { value: 'back', label: 'Back' },
];

const FREE_DAILY_PHOTO_LIMIT = 2;

const PhotoDiaryPage = () => {
  const { addPhoto, deletePhoto, photos: contextPhotos, isLoading: contextLoading, refreshPhotos } = useUserData();
  const { isPremium: isPremiumFromBackend, isAdmin, isLoading: isBackendLoading, refreshSubscription } = useSubscription();
  const {
    platform,
    isNative,
    isPurchasing,
    isRestoring,
    statusMessage,
    isOfferingsReady,
    priceString,
    startPurchase,
    restorePurchases,
    retryOfferings,
    isUserLoggedIn,
    isRevenueCatLoading,
  } = usePaymentRouter();

  // Premium is enforced by backend for ALL platforms.
  const isPremium = isAdmin || isPremiumFromBackend;
  const isSubscriptionLoading = isBackendLoading;

  const [selectedBodyPart, setSelectedBodyPart] = useState<BodyPart | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [isCapturing, setIsCapturing] = useState(false);
  const [newPhotoBodyPart, setNewPhotoBodyPart] = useState<BodyPart>('face');
  const [newPhotoNotes, setNewPhotoNotes] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<VirtualPhoto[]>([]);
  const [showSparkles, setShowSparkles] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showComparePaywall, setShowComparePaywall] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<VirtualPhoto | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Scroll performance: track if user is actively scrolling
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Single photo preview state (for date confirmation)
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [detectedDate, setDetectedDate] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isExifDate, setIsExifDate] = useState(false);
  const [didUserAdjustDate, setDidUserAdjustDate] = useState(false);
  // Track whether photo came from camera vs gallery for date handling
  const [dateSource, setDateSource] = useState<'camera_capture' | 'exif' | 'upload_fallback'>('upload_fallback');
  
  // Batch upload state
  const [showBatchUpload, setShowBatchUpload] = useState(false);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Get user ID for virtualized photos hook
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ANDROID SCROLL OPTIMIZATION: Detect scrolling to pause expensive operations
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolling(true);
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Mark as not scrolling after 200ms of no scroll
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 200);
    };
    
    // Use passive listener for better scroll performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Use virtualized photos with cursor-based pagination
  const {
    photos,
    isLoading,
    hasMore,
    loadMore,
    addPhotoToList,
    removePhotoFromList,
    addOptimisticPhoto,
    resolveOptimisticPhoto,
    removeOptimisticPhoto,
    fetchMediumUrl,
    prefetchMediumUrls,
    refresh,
  } = useVirtualizedPhotos({
    userId,
    bodyPartFilter: selectedBodyPart,
    sortOrder,
  });

  // Single upload hook (shared pipeline for Take Photo / Single Photo)
  const singleUpload = useSingleUpload({
    onSuccess: (photo) => {
      setShowSparkles(true);
      // Also refresh context photos so HomePage updates immediately
      refreshPhotos();
      toast.success('Photo saved to cloud');
    },
    onError: (error) => {
      toast.error(error || 'Failed to save photo');
    },
    onLimitReached: () => {
      setShowUpgradePrompt(true);
      toast.error('Daily photo limit reached');
    },
  });

  // Batch upload hook
  const batchUpload = useBatchUpload({
    concurrency: 1, // Sequential for iOS safety
    skipLimitCheck: isPremium, // Premium users bypass limit
    onComplete: (results) => {
      if (results.success > 0) {
        setShowSparkles(true);
        // Refresh virtualized list for PhotoDiaryPage
        refresh();
        // Also refresh context photos so HomePage updates immediately
        refreshPhotos();
        toast.success(`${results.success} photo${results.success !== 1 ? 's' : ''} uploaded`);
      }
      if (results.failed > 0 && results.success === 0 && !results.limitReached) {
        toast.error(`${results.failed} upload${results.failed !== 1 ? 's' : ''} failed`);
      }
    },
    onLimitReached: () => {
      setShowUpgradePrompt(true);
      toast.error('Daily photo limit reached');
    },
  });

  // Count photos uploaded today using createdAt (actual upload date, not EXIF date)
  const photosUploadedToday = useMemo(() => {
    return contextPhotos.filter(photo => {
      // Use createdAt (upload date) for limit tracking, NOT timestamp (which may be EXIF date)
      const uploadDate = new Date(photo.createdAt);
      return isToday(uploadDate);
    }).length;
  }, [contextPhotos]);

  // Single source of truth for upload limits
  const remainingUploads = Math.max(0, FREE_DAILY_PHOTO_LIMIT - photosUploadedToday);
  const canUploadMore = isPremium || remainingUploads > 0;
  
  // Progress value clamped between 0 and 1 - single source of truth
  const uploadProgress = Math.min(Math.max(photosUploadedToday / FREE_DAILY_PHOTO_LIMIT, 0), 1);
  const isLimitReached = !isPremium && uploadProgress >= 1;

  const handleUpgrade = async () => {
    const result = await startPurchase();
    if (result.success) {
      setShowUpgradePrompt(false);
      setShowComparePaywall(false);
    }
  };

  const handleRestore = async () => {
    const result = await restorePurchases();
    if (result.success && result.isPremiumNow) {
      setShowUpgradePrompt(false);
      setShowComparePaywall(false);
    }
  };

  const handleRetryOfferings = async () => {
    await retryOfferings();
  };

  const handleAddPhotoClick = () => {
    if (!canUploadMore) {
      setShowUpgradePrompt(true);
    } else {
      setIsCapturing(true);
    }
  };

  // Handle camera capture - use device time immediately (no EXIF dependency)
  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    
    if (!file) return;

    // Capture the device time IMMEDIATELY at the moment user takes the photo
    const captureTime = new Date();

    if (import.meta.env.DEV) {
      console.log('[PhotoDiary] Camera capture:', file.name, 'type:', file.type, 'size:', file.size);
      console.log('[PhotoDiary] Setting taken_at to device capture time:', captureTime.toISOString());
    }

    // For camera photos: use device time, don't rely on EXIF
    setDetectedDate(captureTime);
    setSelectedDate(captureTime);
    setIsExifDate(true); // Treat as "reliable date" so it gets stored
    setDidUserAdjustDate(false);
    setDateSource('camera_capture');

    setPendingFile(file);
    // Keep modal open to show date confirmation
  };

  // Handle gallery file selection - extract EXIF date
  const handleGallerySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    
    if (!file) return;

    if (import.meta.env.DEV) {
      console.log('[PhotoDiary] Gallery file selected:', file.name, 'type:', file.type, 'size:', file.size);
    }

    // Extract EXIF date for preview (timezone-less local date string)
    // Use extractExifDateWithSource for detailed logging
    const exifResult = await extractExifDateWithSource(file);
    setDidUserAdjustDate(false);

    if (import.meta.env.DEV) {
      console.log('[PhotoDiary] EXIF extraction result:', exifResult);
    }

    if (exifResult.date && exifResult.source === 'exif') {
      const parsed = parseLocalDateTime(exifResult.date);
      if (parsed) {
        setDetectedDate(parsed);
        setSelectedDate(parsed);
        setIsExifDate(true);
        setDateSource('exif');
        if (import.meta.env.DEV) {
          console.log('[PhotoDiary] Using EXIF date:', parsed);
        }
      } else {
        // EXIF present but unparsable (log + predictable fallback)
        console.warn('[PhotoDiary] EXIF date string present but could not be parsed:', exifResult.date);
        setDetectedDate(null);
        setSelectedDate(new Date());
        setIsExifDate(false);
        setDateSource('upload_fallback');
      }
    } else {
      // Common for images exported/sent via apps (e.g. WhatsApp) where EXIF is stripped.
      console.warn('[PhotoDiary] No EXIF date found; source:', exifResult.source, '- will fall back to upload date unless user selects one');
      setDetectedDate(null);
      setSelectedDate(new Date());
      setIsExifDate(false);
      setDateSource('upload_fallback');
    }

    setPendingFile(file);
    // Keep modal open to show date confirmation
  };

  // Confirm and upload the pending file
  const handleConfirmUpload = async () => {
    if (!pendingFile) return;

    // Close modal immediately for better UX
    setIsCapturing(false);

    // Decide what to store in taken_at:
    // - If EXIF was found and user didn't adjust → let the upload hook store extracted EXIF
    // - If EXIF missing and user didn't adjust → store NULL (UI will fall back to upload date)
    // - If user adjusted → store their chosen local date
    const shouldStoreNullTakenAt = !isExifDate && !didUserAdjustDate;

    // Format selectedDate as timezone-less ISO for storage in `timestamp without time zone`
    const pad = (n: number) => n.toString().padStart(2, '0');
    const takenAtLocal = `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}T${pad(selectedDate.getHours())}:${pad(selectedDate.getMinutes())}:${pad(selectedDate.getSeconds())}`;

    // Add optimistic placeholder immediately (instant visual feedback)
    const tempId = addOptimisticPhoto(
      pendingFile, 
      newPhotoBodyPart, 
      shouldStoreNullTakenAt ? new Date().toISOString() : takenAtLocal
    );

    // Store refs before clearing state
    const fileToUpload = pendingFile;
    const bodyPartToUpload = newPhotoBodyPart;
    const notesToUpload = newPhotoNotes || undefined;
    const takenAtToUpload = shouldStoreNullTakenAt ? null : takenAtLocal;

    // Clear form state immediately
    setNewPhotoNotes('');
    setPendingFile(null);
    setDetectedDate(null);
    setDidUserAdjustDate(false);
    setDateSource('upload_fallback');

    // Start upload in background
    const uploadedPhoto = await singleUpload.processAndUploadFile(fileToUpload, {
      bodyPart: bodyPartToUpload,
      notes: notesToUpload,
      takenAtOverride: takenAtToUpload,
      skipLimitCheck: isPremium, // Premium users bypass limit
    });

    if (uploadedPhoto) {
      // Debug logging for verification
      if (import.meta.env.DEV) {
        const finalDateSource = didUserAdjustDate ? 'user' : dateSource;
        console.log('[PhotoDiary] Upload complete:', {
          photo_id: uploadedPhoto.id,
          taken_at: uploadedPhoto.takenAt,
          date_source: finalDateSource,
          exif_present: dateSource === 'exif',
          was_camera: dateSource === 'camera_capture',
        });
      }
      
      // Convert to VirtualPhoto and add directly - no refresh needed!
      const realPhoto: VirtualPhoto = {
        id: uploadedPhoto.id,
        thumbnailUrl: uploadedPhoto.thumbUrl,
        mediumUrl: uploadedPhoto.mediumUrl,
        originalUrl: uploadedPhoto.originalUrl || undefined,
        bodyPart: uploadedPhoto.bodyPart as VBodyPart,
        takenAt: uploadedPhoto.takenAt,
        uploadedAt: uploadedPhoto.createdAt,
        timestamp: uploadedPhoto.takenAt || uploadedPhoto.createdAt,
        notes: uploadedPhoto.notes || undefined,
      };
      
      // Resolve optimistic photo with real data - seamless transition
      resolveOptimisticPhoto(tempId, realPhoto);
    } else {
      // Upload failed - remove the optimistic placeholder
      removeOptimisticPhoto(tempId);
    }
  };

  const handleCancelPending = () => {
    setPendingFile(null);
    setDetectedDate(null);
    setDidUserAdjustDate(false);
    setDateSource('upload_fallback');
  };

  // Handle batch file selection from gallery
  const handleBatchFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    
    // Reset input immediately to allow re-selecting same files
    e.target.value = '';
    
    // Debug: log file selection
    if (import.meta.env.DEV) {
      console.log('[BatchUpload] File input change event fired');
      console.log('[BatchUpload] FileList:', fileList);
      console.log('[BatchUpload] Number of files:', fileList?.length ?? 0);
      
      if (fileList && fileList.length > 0) {
        Array.from(fileList).forEach((f, i) => {
          console.log(`[BatchUpload] File ${i + 1}:`, f.name, 'type:', f.type, 'size:', f.size);
        });
      }
    }
    
    if (!fileList || fileList.length === 0) {
      if (import.meta.env.DEV) {
        console.error('[BatchUpload] No files detected in selection');
      }
      toast.error('No photos selected. Please try again.');
      return;
    }
    
    // Convert FileList to array
    const filesArray = Array.from(fileList);

    let filesToUpload: File[];

    // Check upload limits for free users
    if (!isPremium) {
      const allowedCount = Math.max(0, remainingUploads);
      if (allowedCount === 0) {
        setShowUpgradePrompt(true);
        return;
      }
      if (filesArray.length > allowedCount) {
        toast.info(`Only ${allowedCount} photo${allowedCount !== 1 ? 's' : ''} can be uploaded today. Upgrade for unlimited.`);
        filesToUpload = filesArray.slice(0, allowedCount);
      } else {
        filesToUpload = filesArray;
      }
    } else {
      filesToUpload = filesArray;
    }

    // Close add photo modal if open
    setIsCapturing(false);
    
    // Set default body part from current filter if applicable
    if (selectedBodyPart !== 'all') {
      batchUpload.setBodyPart(selectedBodyPart);
    } else {
      batchUpload.setBodyPart(newPhotoBodyPart);
    }

    // Store files and show modal - DON'T start upload yet, let user confirm body part
    setBatchFiles(filesToUpload);
    setShowBatchUpload(true);
    
    if (import.meta.env.DEV) {
      console.log('[BatchUpload] Modal opened with', filesToUpload.length, 'files. Waiting for user to start upload.');
    }
  };

  const handleStartBatchUpload = async () => {
    if (batchFiles.length === 0) return;
    
    if (import.meta.env.DEV) {
      console.log('[BatchUpload] User started upload of', batchFiles.length, 'files');
    }
    
    try {
      await batchUpload.startUpload(batchFiles);
    } catch (error) {
      console.error('[BatchUpload] Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed. Please try again.');
    }
  };

  const handleCloseBatchUpload = () => {
    setShowBatchUpload(false);
    setBatchFiles([]);
    batchUpload.reset();
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePhoto(id);
      removePhotoFromList(id);
      toast.success('Photo deleted');
    } catch (error) {
      toast.error('Failed to delete photo');
    }
  };

  const togglePhotoSelection = useCallback(
    (photo: VirtualPhoto) => {
      setSelectedPhotos((prev) => {
        const isSelected = prev.find((p) => p.id === photo.id);
        if (isSelected) {
          return prev.filter((p) => p.id !== photo.id);
        } else if (prev.length < 2) {
          return [...prev, photo];
        }
        return prev;
      });
    },
    []
  );

  const handlePhotoSelect = useCallback(
    (photo: VirtualPhoto) => {
      if (compareMode) {
        togglePhotoSelection(photo);
      } else {
        // OPTIMIZATION: Start fetching medium URL IMMEDIATELY on click
        // Don't wait for dialog to open - this makes it feel instant
        if (!photo.mediumUrl) {
          fetchMediumUrl(photo.id).then((url) => {
            // Update the photo in the list with medium URL
            setViewingPhoto((prev) => {
              if (prev?.id === photo.id) {
                return { ...prev, mediumUrl: url };
              }
              return prev;
            });
          }).catch(() => {
            // Silently fail - will retry when dialog opens
          });
        }
        setViewingPhoto(photo);
      }
    },
    [compareMode, togglePhotoSelection, fetchMediumUrl]
  );

  // OPTIMIZATION: Prefetch medium URLs for visible photos in viewport
  // This makes clicking photos feel instant since they're already loaded
  // ANDROID: Skip during scroll to prevent jank
  useEffect(() => {
    if (compareMode) return; // Don't prefetch during compare mode
    if (isScrolling) return; // CRITICAL: Don't prefetch while scrolling (Android performance)
    if (photos.length === 0) return;
    
    // Prefetch first 6 visible photos (most likely to be clicked)
    const visiblePhotos = photos.slice(0, 6);
    const idsToFetch = visiblePhotos
      .filter(p => !p.mediumUrl) // Only fetch if not already loaded
      .map(p => p.id);
    
    if (idsToFetch.length === 0) return;
    
    // Prefetch in background with low priority
    const prefetchTimeout = setTimeout(() => {
      prefetchMediumUrls(idsToFetch).catch(() => {
        // Silently fail - will retry on click
      });
    }, 500); // Wait 500ms after render to avoid blocking initial load
    
    return () => clearTimeout(prefetchTimeout);
  }, [photos, compareMode, isScrolling, prefetchMediumUrls]);

  // Fullscreen: fetch medium on-demand (never during scroll)
  useEffect(() => {
    if (!viewingPhoto) return;
    if (viewingPhoto.mediumUrl) return;

    let cancelled = false;
    fetchMediumUrl(viewingPhoto.id)
      .then((url) => {
        if (cancelled) return;
        setViewingPhoto((prev) => {
          if (!prev || prev.id !== viewingPhoto.id) return prev;
          if (prev.mediumUrl === url) return prev;
          return { ...prev, mediumUrl: url };
        });
      })
      .catch(() => {
        // keep placeholder; error UI handled by ProgressiveImage once src exists
      });

    return () => {
      cancelled = true;
    };
  }, [viewingPhoto, fetchMediumUrl]);

  // OPTIMIZATION: Prefetch adjacent photos when viewing a photo
  // Makes swiping to next/previous photo instant
  useEffect(() => {
    if (!viewingPhoto) return;
    
    const currentIndex = photos.findIndex(p => p.id === viewingPhoto.id);
    if (currentIndex === -1) return;
    
    const adjacentIds: string[] = [];
    
    // Previous photo
    if (currentIndex > 0 && !photos[currentIndex - 1].mediumUrl) {
      adjacentIds.push(photos[currentIndex - 1].id);
    }
    
    // Next photo
    if (currentIndex < photos.length - 1 && !photos[currentIndex + 1].mediumUrl) {
      adjacentIds.push(photos[currentIndex + 1].id);
    }
    
    if (adjacentIds.length === 0) return;
    
    // Prefetch adjacent photos in background
    prefetchMediumUrls(adjacentIds).catch(() => {
      // Silently fail
    });
  }, [viewingPhoto, photos, prefetchMediumUrls]);

  const selectedCompareIdsKey = useMemo(
    () => selectedPhotos.map((p) => p.id).join('|'),
    [selectedPhotos]
  );

  // Compare: fetch medium only for the selected images (idempotent)
  useEffect(() => {
    if (!compareMode) return;
    if (!selectedCompareIdsKey) return;

    const ids = selectedCompareIdsKey.split('|').filter(Boolean);

    prefetchMediumUrls(ids)
      .then((map) => {
        setSelectedPhotos((prev) => {
          let changed = false;
          const next = prev.map((p) => {
            const nextUrl = map.get(p.id);
            if (nextUrl && nextUrl !== p.mediumUrl) {
              changed = true;
              return { ...p, mediumUrl: nextUrl };
            }
            return p;
          });
          return changed ? next : prev;
        });
      })
      .catch(() => {
        // keep placeholders
      });
  }, [compareMode, selectedCompareIdsKey, prefetchMediumUrls]);

  // Show skeleton while subscription is loading to prevent premium UI flash
  if (isSubscriptionLoading) {
    return <PhotoDiaryPageSkeleton />;
  }

  return (
    <div className="px-4 md:px-8 lg:px-12 py-6 space-y-6 max-w-lg md:max-w-none mx-auto relative">
      {/* Sparkle celebration effect */}
      <SparkleEffect isActive={showSparkles} onComplete={() => setShowSparkles(false)} />
      
      {/* Decorative elements */}
      <div className="decorative-blob w-32 h-32 bg-coral/25 -top-10 -left-10 fixed" />
      <div className="decorative-blob w-44 h-44 bg-honey/20 bottom-32 -right-16 fixed" />
      
      {/* Decorative illustrations */}
      <LeafIllustration variant="branch" className="w-24 h-20 fixed top-16 right-0 opacity-30 pointer-events-none" />
      <SparkleIllustration variant="trail" className="w-28 h-10 fixed bottom-56 left-0 opacity-25 pointer-events-none" />
      
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground text-warm-shadow">Photo Diary</h1>
          <p className="text-muted-foreground">Track your skin's progress</p>
        </div>
        {compareMode ? (
          <Button 
            variant="outline" 
            size="sm"
            className="rounded-xl"
            onClick={() => {
              setCompareMode(false);
              setSelectedPhotos([]);
            }}
          >
            Exit Compare
          </Button>
        ) : (
          <Button 
            variant="outline" 
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => setCompareMode(true)}
            disabled={photos.length < 2 || isSubscriptionLoading}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Compare
          </Button>
        )}
      </div>

      {/* Immersive Compare View - fullscreen overlay */}
      {compareMode && selectedPhotos.length === 2 && (
        <ComparisonViewer
          photos={selectedPhotos}
          onExit={() => {
            setCompareMode(false);
            setSelectedPhotos([]);
          }}
        />
      )}

      {compareMode && selectedPhotos.length < 2 && (
        <div className="glass-card p-5 text-center text-muted-foreground animate-fade-in">
          <Sparkles className="w-8 h-8 mx-auto mb-2 text-primary" />
          Select {2 - selectedPhotos.length} more photo{selectedPhotos.length === 0 ? 's' : ''} to compare
        </div>
      )}

      {/* Body Part Filter + Sort Control */}
      <div className="space-y-3 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        {/* Body Part Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <Button
            variant={selectedBodyPart === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedBodyPart('all')}
            className="shrink-0 rounded-xl"
          >
            All
          </Button>
          {bodyParts.map(({ value, label }) => (
            <Button
              key={value}
              variant={selectedBodyPart === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedBodyPart(value)}
              className="shrink-0 rounded-xl"
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Sort Control */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {photos.length} photo{photos.length !== 1 ? 's' : ''}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
            className="gap-1.5 text-sm h-8 px-2.5"
          >
            {sortOrder === 'newest' ? (
              <>
                <ArrowDown className="w-3.5 h-3.5" />
                Newest first
              </>
            ) : (
              <>
                <ArrowUp className="w-3.5 h-3.5" />
                Oldest first
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Upload status indicator */}
      {isSubscriptionLoading ? (
        <div className="glass-card p-4 animate-fade-in">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Checking subscription...</span>
          </div>
        </div>
      ) : isPremium ? (
        <div className="glass-card p-4 animate-fade-in">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Crown className="w-4 h-4 text-primary" />
            Unlimited photo uploads
          </p>
        </div>
      ) : (
        <div className="glass-card p-4 space-y-3 animate-fade-in">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Free plan: {FREE_DAILY_PHOTO_LIMIT} photos per day
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upgrade to Premium for unlimited photo uploads.
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{photosUploadedToday} of {FREE_DAILY_PHOTO_LIMIT} used</span>
              <span>{Math.round(uploadProgress * 100)}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isLimitReached 
                    ? "bg-gradient-to-r from-sage to-sage/80" 
                    : "bg-gradient-to-r from-primary to-primary/70"
                )}
                style={{ width: `${uploadProgress * 100}%` }}
              />
            </div>
          </div>
          
          {/* Upgrade Button */}
          <div className="space-y-2">
            <Button 
              onClick={handleUpgrade} 
              disabled={isPurchasing} 
              variant="gold" 
              className="w-full gap-2"
            >
              <Crown className="w-4 h-4" />
              {isPurchasing ? 'Loading...' : `Start 14-Day Free Trial · ${priceString}`}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              {priceString} after 14-day free trial. Auto-renewable. Cancel anytime.
            </p>
            <p className="text-xs text-muted-foreground/70 text-center">
              By subscribing, you agree to our{' '}
              <a 
                href={getTermsUrl(platform as Platform)} 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-foreground transition-colors"
              >
                Terms of Use
              </a>{' '}
              and{' '}
              <a 
                href={PRIVACY_POLICY_URL} 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-foreground transition-colors"
              >
                Privacy Policy
              </a>.
            </p>
          </div>
        </div>
      )}

      {/* Upgrade Prompt Dialog */}
      <Dialog open={showUpgradePrompt} onOpenChange={setShowUpgradePrompt}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Daily Limit Reached
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <p className="text-muted-foreground">
              You've uploaded {FREE_DAILY_PHOTO_LIMIT} photos today. Upgrade to Premium for unlimited photo uploads!
            </p>
            <div className="p-4 bg-muted/50 rounded-xl">
              <p className="text-sm text-muted-foreground">Your limit resets tomorrow</p>
            </div>
            <div className="space-y-2">
                <Button 
                onClick={handleUpgrade} 
                disabled={isPurchasing || (isNative && !isOfferingsReady)} 
                variant="gold" 
                className="w-full gap-2"
              >
                {isPurchasing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing…
                  </>
                ) : isNative && !isOfferingsReady ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4" />
                    Start 14-Day Free Trial · {priceString}
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                {priceString} after 14-day free trial. Auto-renewable. Cancel anytime.
              </p>
              <p className="text-xs text-muted-foreground/70 text-center">
                By subscribing, you agree to our{' '}
                <a 
                  href={getTermsUrl(platform as Platform)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground transition-colors"
                >
                  Terms of Use
                </a>{' '}
                and{' '}
                <a 
                  href={PRIVACY_POLICY_URL} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground transition-colors"
                >
                  Privacy Policy
                </a>.
              </p>

              {/* Native: Retry button if offerings failed */}
              {isNative && !isOfferingsReady && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleRetryOfferings}
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry loading
                </Button>
              )}

              {/* Native: Restore purchases */}
              {isNative && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                  onClick={handleRestore}
                  disabled={isRestoring}
                >
                  {isRestoring ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Restoring…
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3 h-3" />
                      Restore purchases
                    </>
                  )}
                </Button>
              )}
            </div>
            <Button variant="ghost" onClick={() => setShowUpgradePrompt(false)} className="w-full">
              Maybe Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compare Paywall Modal */}
      <Dialog open={showComparePaywall} onOpenChange={setShowComparePaywall}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Compare is Premium
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground text-center">
              Unlock side-by-side photo comparison to visually track your skin's progress over time.
            </p>
            <div className="p-4 bg-gradient-to-br from-primary/10 to-sage-light/30 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Compare photos side by side</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Track visual progress over time</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Unlimited photo uploads</span>
              </div>
            </div>
            <div className="space-y-2">
              <Button 
                onClick={handleUpgrade} 
                disabled={isPurchasing || (isNative && !isOfferingsReady)}
                className="w-full gap-2"
                variant="gold"
              >
                {isPurchasing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing…
                  </>
                ) : isNative && !isOfferingsReady ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4" />
                    Start 14-Day Free Trial · {priceString}
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                {priceString} after 14-day free trial. Auto-renewable. Cancel anytime.
              </p>
              <p className="text-xs text-muted-foreground/70 text-center">
                By subscribing, you agree to our{' '}
                <a 
                  href={getTermsUrl(platform as Platform)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground transition-colors"
                >
                  Terms of Use
                </a>{' '}
                and{' '}
                <a 
                  href={PRIVACY_POLICY_URL} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground transition-colors"
                >
                  Privacy Policy
                </a>.
              </p>

              {/* Native: Retry button if offerings failed */}
              {isNative && !isOfferingsReady && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleRetryOfferings}
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry loading
                </Button>
              )}

              {/* Native: Restore purchases */}
              {isNative && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                  onClick={handleRestore}
                  disabled={isRestoring}
                >
                  {isRestoring ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Restoring…
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3 h-3" />
                      Restore purchases
                    </>
                  )}
                </Button>
              )}
            </div>
            <Button 
              variant="ghost" 
              onClick={() => setShowComparePaywall(false)} 
              className="w-full"
            >
              Maybe Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Photo Button */}
      <div className="space-y-3">
        <Button 
          variant={!isSubscriptionLoading && !isPremium && !canUploadMore ? "outline" : "default"}
          className="w-full gap-2 h-12"
          onClick={handleAddPhotoClick}
          disabled={isSubscriptionLoading || (!isPremium && !canUploadMore)}
        >
          {isSubscriptionLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading...
            </>
          ) : !isPremium && !canUploadMore ? (
            <>
              <Lock className="w-5 h-5" />
              Daily limit reached
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              Add Photo
            </>
          )}
        </Button>
        
        {/* Upgrade CTA when limit reached */}
        {!isSubscriptionLoading && !isPremium && !canUploadMore && (
          <div className="space-y-2">
            <Button 
              variant="gold" 
              className="w-full gap-2 h-12"
              onClick={handleUpgrade}
              disabled={isPurchasing}
            >
              <Crown className="w-5 h-5" />
              {isPurchasing ? 'Loading...' : `Start 14-Day Free Trial · ${priceString}`}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              {priceString} after 14-day free trial. Auto-renewable. Cancel anytime.
            </p>
            <p className="text-xs text-muted-foreground/70 text-center">
              By subscribing, you agree to our{' '}
              <a 
                href={getTermsUrl(platform as Platform)} 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-foreground transition-colors"
              >
                Terms of Use
              </a>{' '}
              and{' '}
              <a 
                href={PRIVACY_POLICY_URL} 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-foreground transition-colors"
              >
                Privacy Policy
              </a>.
            </p>
          </div>
        )}
      </div>

      {/* Add Photo Dialog */}
      <Dialog open={isCapturing} onOpenChange={(open) => { if (!open) { setIsCapturing(false); setPendingFile(null); } else setIsCapturing(true); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {pendingFile ? 'Confirm Photo Date' : 'Add New Photo'}
            </DialogTitle>
          </DialogHeader>
          
          {pendingFile ? (
            /* Date confirmation step */
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-xl text-center">
                <p className="text-sm font-medium mb-1">
                  {isExifDate ? 'Date detected from photo:' : 'No metadata date found'}
                </p>
                <p className={cn("text-sm", !isExifDate && "text-muted-foreground")}>
                  {isExifDate
                    ? format(selectedDate, 'MMMM d, yyyy')
                    : 'We’ll use the upload date unless you pick a date below.'}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-semibold mb-2 block">Date Taken</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left h-11 rounded-xl">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(selectedDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-auto p-0 z-[100]" 
                    align="center"
                    side="bottom"
                    sideOffset={4}
                    avoidCollisions={false}
                  >
                    <div className="w-[310px] min-h-[340px]">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                          if (!date) return;
                          setSelectedDate(date);
                          setDidUserAdjustDate(true);
                        }}
                        disabled={(date) => date > new Date()}
                        initialFocus
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-11" onClick={handleCancelPending}>
                  Back
                </Button>
                <Button variant="default" className="flex-1 h-11" onClick={handleConfirmUpload} disabled={singleUpload.isUploading}>
                  {singleUpload.isUploading ? 'Uploading...' : 'Upload Photo'}
                </Button>
              </div>
            </div>
          ) : (
            /* Initial selection step */
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-2 block">Body Part</label>
                <Select value={newPhotoBodyPart} onValueChange={(v) => setNewPhotoBodyPart(v as BodyPart)}>
                  <SelectTrigger className="h-11 rounded-xl border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bodyParts.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">Notes (optional)</label>
                <Textarea 
                  placeholder="Any notes about this photo..."
                  value={newPhotoNotes}
                  onChange={(e) => setNewPhotoNotes(e.target.value)}
                  rows={2}
                  className="rounded-xl border-2 resize-none"
                />
              </div>
              <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleCameraCapture} className="hidden" />
              <input type="file" accept="image/*,image/heic,image/heif,image/vnd.android.heic,.heic,.heif" ref={galleryInputRef} onChange={handleGallerySelect} className="hidden" />
              <div className="grid grid-cols-2 gap-3">
                <Button variant="default" className="h-11 gap-2" onClick={() => cameraInputRef.current?.click()} disabled={singleUpload.isUploading}>
                  <Camera className="w-5 h-5" />Take Photo
                </Button>
                <Button variant="outline" className="h-11 gap-2" onClick={() => galleryInputRef.current?.click()} disabled={singleUpload.isUploading}>
                  <ImagePlus className="w-5 h-5" />Gallery
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Batch Upload Modal */}
      <BatchUploadModal
        open={showBatchUpload}
        onOpenChange={setShowBatchUpload}
        items={batchUpload.items}
        isUploading={batchUpload.isUploading}
        stats={batchUpload.stats}
        currentIndex={batchUpload.currentIndex}
        bodyPart={batchUpload.bodyPart}
        onBodyPartChange={batchUpload.setBodyPart}
        onStartUpload={handleStartBatchUpload}
        onRetryFailed={batchUpload.retryFailed}
        onCancel={batchUpload.cancel}
        onClose={handleCloseBatchUpload}
        selectedFiles={batchFiles}
      />

      {/* Photos Grid - Virtualized with cursor-based pagination */}
      {isLoading && photos.length === 0 ? (
        <PhotoSkeleton count={4} />
      ) : photos.length === 0 ? (
        <div className="glass-card-warm p-8 text-center animate-fade-in relative overflow-hidden">
          <LeafIllustration variant="cluster" className="w-20 h-20 absolute -right-4 -bottom-4 opacity-15" />
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-sage-light flex items-center justify-center relative">
            <Image className="w-8 h-8 text-primary" />
          </div>
          <p className="font-display font-bold text-lg text-foreground">No photos yet</p>
          <p className="text-muted-foreground mt-1">
            Start tracking your progress by adding a photo
          </p>
        </div>
      ) : (
        <VirtualizedPhotoGrid
          photos={photos}
          selectedPhotos={selectedPhotos}
          compareMode={compareMode}
          onPhotoSelect={handlePhotoSelect}
          onLoadMore={loadMore}
          hasMore={hasMore}
          bodyParts={bodyParts}
        />
      )}

      {/* Photo Viewer Dialog - fullscreen mobile layout with sticky header/footer */}
      <Dialog open={!!viewingPhoto} onOpenChange={(open) => !open && setViewingPhoto(null)}>
        <DialogContentFullscreen className="bg-muted/95">
          {viewingPhoto && (
            <>
              {/* Sticky Header - uses iOS-specific offset to clear Dynamic Island */}
              <div 
                className="sticky top-0 z-10 flex items-center justify-between px-4 pb-3 bg-muted/95 backdrop-blur-sm border-b border-border/50"
                style={{ paddingTop: 'calc(var(--ios-dialog-header-extra, 0px) + 12px)' }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full">
                    {bodyParts.find(b => b.value === viewingPhoto.bodyPart)?.label}
                  </span>
                  <div className="text-sm text-muted-foreground">
                    <span>{format(parseLocalDateTime(viewingPhoto.timestamp) || new Date(viewingPhoto.timestamp), 'MMM d, yyyy')}</span>
                    {!viewingPhoto.takenAt && (
                      <span className="text-xs ml-1 opacity-70">(uploaded)</span>
                    )}
                  </div>
                </div>
                <DialogClose className="rounded-full p-3 hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </div>

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-auto flex flex-col items-center justify-center px-4 py-4">
                <div className="w-full max-w-lg">
                  <ModalImage
                    thumbnailSrc={viewingPhoto.thumbnailUrl}
                    highResSrc={viewingPhoto.mediumUrl || viewingPhoto.originalUrl}
                    alt={`${viewingPhoto.bodyPart} photo`}
                  />
                  {viewingPhoto.notes && (
                    <p className="text-sm text-foreground mt-4 text-center">{viewingPhoto.notes}</p>
                  )}
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="sticky bottom-0 z-10 px-4 py-3 bg-muted/95 backdrop-blur-sm border-t border-border/50 safe-area-inset-bottom">
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    handleDelete(viewingPhoto.id);
                    setViewingPhoto(null);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Photo
                </Button>
              </div>
            </>
          )}

          {/* Hidden accessible header for screen readers */}
          <DialogHeader className="sr-only">
            <DialogTitle>Photo</DialogTitle>
            <DialogDescription>
              View your photo with a fast preview (thumbnail) and a higher quality version (medium).
            </DialogDescription>
          </DialogHeader>
        </DialogContentFullscreen>
      </Dialog>
    </div>
  );
};

export default PhotoDiaryPage;