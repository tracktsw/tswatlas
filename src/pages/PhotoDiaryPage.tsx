import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Camera, Plus, Trash2, Image, Sparkles, Lock, Crown } from 'lucide-react';
import { useUserData, BodyPart, Photo } from '@/contexts/UserDataContext';
import { useVirtualizedPhotos, VirtualPhoto } from '@/hooks/useVirtualizedPhotos';
import { VirtualizedPhotoGrid } from '@/components/VirtualizedPhotoGrid';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { LeafIllustration, SparkleIllustration } from '@/components/illustrations';
import { SparkleEffect } from '@/components/SparkleEffect';
import { PhotoSkeleton } from '@/components/PhotoSkeleton';

// Progressive image component for modal - shows thumb placeholder, then loads medium/original
const ModalImage = ({
  thumbnailSrc,
  highResSrc,
  alt,
}: {
  thumbnailSrc?: string;
  highResSrc?: string;
  alt: string;
}) => {
  const [highResLoaded, setHighResLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const hasThumb = typeof thumbnailSrc === "string" && thumbnailSrc.length > 0;
  const hasHighRes = typeof highResSrc === "string" && highResSrc.length > 0;

  return (
    <div className="relative flex items-center justify-center bg-black min-h-[200px]">
      {/* Loading shimmer - shows while no image is ready */}
      {!highResLoaded && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50 animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-background/10 to-transparent animate-shimmer" />
        </div>
      )}

      {/* Thumbnail placeholder - blurred, shows immediately while high-res loads */}
      {hasThumb && !highResLoaded && !hasError && (
        <img
          src={thumbnailSrc}
          alt={alt}
          className="max-w-full max-h-[80vh] object-contain blur-sm scale-105 opacity-70"
        />
      )}

      {/* High-res image - fades in over thumbnail */}
      {hasHighRes && (
        <img
          src={highResSrc}
          alt={alt}
          loading="eager"
          decoding="async"
          onLoad={() => setHighResLoaded(true)}
          onError={() => setHasError(true)}
          className={cn(
            "max-w-full max-h-[80vh] object-contain transition-opacity duration-300",
            highResLoaded ? "opacity-100" : "opacity-0 absolute"
          )}
        />
      )}

      {/* Fallback if no high-res available - show thumb at full size */}
      {!hasHighRes && hasThumb && (
        <img
          src={thumbnailSrc}
          alt={alt}
          className="max-w-full max-h-[80vh] object-contain"
        />
      )}

      {hasError && (
        <div className="flex items-center justify-center p-8">
          <Image className="w-12 h-12 text-muted-foreground/50" />
        </div>
      )}
    </div>
  );
};

// Compare view progressive image - shows thumbnail, swaps to medium
const CompareImage = ({
  thumbnailSrc,
  mediumSrc,
  alt,
  className,
}: {
  thumbnailSrc?: string;
  mediumSrc?: string;
  alt: string;
  className?: string;
}) => {
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [mediumLoaded, setMediumLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const hasThumb = typeof thumbnailSrc === "string" && thumbnailSrc.length > 0;
  const hasMedium = typeof mediumSrc === "string" && mediumSrc.length > 0;

  return (
    <div className={cn("relative bg-muted overflow-hidden", className)}>
      {!thumbLoaded && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50 animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-background/10 to-transparent animate-shimmer" />
        </div>
      )}

      {hasThumb && (
        <img
          src={thumbnailSrc}
          alt={alt}
          loading="eager"
          onLoad={() => setThumbLoaded(true)}
          onError={() => setHasError(true)}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
            thumbLoaded ? "opacity-100" : "opacity-0",
            mediumLoaded ? "opacity-0" : "opacity-100"
          )}
        />
      )}

      {hasMedium && thumbLoaded && (
        <img
          src={mediumSrc}
          alt={alt}
          loading="eager"
          onLoad={() => setMediumLoaded(true)}
          onError={() => setHasError(true)}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-500",
            mediumLoaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Image className="w-8 h-8 text-muted-foreground/50" />
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
  const { addPhoto, deletePhoto, photos: contextPhotos, isLoading: contextLoading } = useUserData();
  const { isPremium } = useSubscription();
  const [selectedBodyPart, setSelectedBodyPart] = useState<BodyPart | 'all'>('all');
  const [isCapturing, setIsCapturing] = useState(false);
  const [newPhotoBodyPart, setNewPhotoBodyPart] = useState<BodyPart>('face');
  const [newPhotoNotes, setNewPhotoNotes] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<VirtualPhoto[]>([]);
  const [showSparkles, setShowSparkles] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<VirtualPhoto | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Use virtualized photos with cursor-based pagination
  const {
    photos,
    isLoading,
    hasMore,
    loadMore,
    addPhotoToList,
    removePhotoFromList,
    fetchMediumUrl,
    prefetchMediumUrls,
    refresh,
  } = useVirtualizedPhotos({
    userId,
    bodyPartFilter: selectedBodyPart,
  });

  // Count photos uploaded today (use context photos for accurate count)
  const photosUploadedToday = useMemo(() => {
    return contextPhotos.filter(photo => {
      const photoDate = new Date(photo.timestamp);
      return isToday(photoDate);
    }).length;
  }, [contextPhotos]);

  const canUploadMore = isPremium || photosUploadedToday < FREE_DAILY_PHOTO_LIMIT;
  const remainingUploads = FREE_DAILY_PHOTO_LIMIT - photosUploadedToday;

  const handleUpgrade = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to subscribe');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        toast.error('Failed to start checkout');
        return;
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Failed to start checkout');
    }
  };

  const handleAddPhotoClick = () => {
    if (!canUploadMore) {
      setShowUpgradePrompt(true);
    } else {
      setIsCapturing(true);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      try {
        await addPhoto({
          dataUrl,
          bodyPart: newPhotoBodyPart,
          notes: newPhotoNotes || undefined,
        });
        setNewPhotoNotes('');
        setIsCapturing(false);
        setShowSparkles(true);
        toast.success('Photo saved to cloud');
        // Refresh the virtualized list
        refresh();
      } catch (error) {
        toast.error('Failed to save photo');
      }
    };
    reader.readAsDataURL(file);
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
      if (selectedPhotos.find((p) => p.id === photo.id)) {
        setSelectedPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      } else if (selectedPhotos.length < 2) {
        setSelectedPhotos((prev) => [...prev, photo]);
      }
    },
    [selectedPhotos]
  );

  const handlePhotoSelect = useCallback(
    (photo: VirtualPhoto) => {
      if (compareMode) {
        togglePhotoSelection(photo);
      } else {
        setViewingPhoto(photo);
      }
    },
    [compareMode, togglePhotoSelection]
  );

  // Fullscreen: fetch medium on-demand (never during scroll)
  useEffect(() => {
    if (!viewingPhoto) return;
    if (viewingPhoto.mediumUrl) return;

    let cancelled = false;
    fetchMediumUrl(viewingPhoto.id)
      .then((url) => {
        if (cancelled) return;
        setViewingPhoto((prev) =>
          prev && prev.id === viewingPhoto.id ? { ...prev, mediumUrl: url } : prev
        );
      })
      .catch(() => {
        // keep placeholder; error UI handled by ProgressiveImage once src exists
      });

    return () => {
      cancelled = true;
    };
  }, [viewingPhoto, fetchMediumUrl]);

  // Compare: fetch medium only for the selected images
  useEffect(() => {
    if (!compareMode) return;
    if (selectedPhotos.length === 0) return;

    const ids = selectedPhotos.map((p) => p.id);

    prefetchMediumUrls(ids)
      .then((map) => {
        setSelectedPhotos((prev) =>
          prev.map((p) => ({ ...p, mediumUrl: map.get(p.id) || p.mediumUrl }))
        );
      })
      .catch(() => {
        // keep placeholders
      });
  }, [compareMode, selectedPhotos, prefetchMediumUrls]);

  return (
    <div className="px-4 py-6 space-y-6 max-w-lg mx-auto relative">
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
            className="rounded-xl"
            onClick={() => setCompareMode(true)}
            disabled={photos.length < 2}
          >
            Compare
          </Button>
        )}
      </div>

      {/* Compare View - uses medium resolution images */}
      {compareMode && selectedPhotos.length === 2 && (
        <div className="glass-card-warm p-5 space-y-4 animate-scale-in">
          <h3 className="font-display font-bold text-center text-foreground">Side by Side Comparison</h3>
          <div className="grid grid-cols-2 gap-3">
            {selectedPhotos.map((photo, idx) => (
              <div key={photo.id} className="space-y-2">
                <CompareImage 
                  thumbnailSrc={photo.thumbnailUrl}
                  mediumSrc={photo.mediumUrl}
                  alt={`Comparison ${idx + 1}`}
                  className="w-full aspect-square rounded-2xl shadow-warm"
                />
                <p className="text-xs text-muted-foreground text-center font-medium">
                  {format(new Date(photo.timestamp), 'MMM d, yyyy')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {compareMode && selectedPhotos.length < 2 && (
        <div className="glass-card p-5 text-center text-muted-foreground animate-fade-in">
          <Sparkles className="w-8 h-8 mx-auto mb-2 text-coral" />
          Select {2 - selectedPhotos.length} more photo{selectedPhotos.length === 0 ? 's' : ''} to compare
        </div>
      )}

      {/* Body Part Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <Button
          variant={selectedBodyPart === 'all' ? 'warm' : 'outline'}
          size="sm"
          onClick={() => setSelectedBodyPart('all')}
          className="shrink-0 rounded-xl"
        >
          All
        </Button>
        {bodyParts.map(({ value, label }) => (
          <Button
            key={value}
            variant={selectedBodyPart === value ? 'warm' : 'outline'}
            size="sm"
            onClick={() => setSelectedBodyPart(value)}
            className="shrink-0 rounded-xl"
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Free user limit indicator */}
      {!isPremium && (
        <div className="glass-card p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {canUploadMore 
                  ? `${remainingUploads} photo${remainingUploads !== 1 ? 's' : ''} left today`
                  : 'Daily limit reached'
                }
              </p>
            </div>
            {!canUploadMore && (
              <Button size="sm" onClick={handleUpgrade} className="gap-1.5 rounded-xl">
                <Crown className="w-4 h-4" />
                Upgrade
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{photosUploadedToday} of {FREE_DAILY_PHOTO_LIMIT} used</span>
              <span>{Math.round((photosUploadedToday / FREE_DAILY_PHOTO_LIMIT) * 100)}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  canUploadMore 
                    ? "bg-gradient-to-r from-primary to-primary/70" 
                    : "bg-gradient-to-r from-coral to-destructive"
                )}
                style={{ width: `${Math.min((photosUploadedToday / FREE_DAILY_PHOTO_LIMIT) * 100, 100)}%` }}
              />
            </div>
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
            <Button onClick={handleUpgrade} className="w-full gap-2">
              <Crown className="w-4 h-4" />
              Upgrade to Premium - £5.99/month
            </Button>
            <Button variant="ghost" onClick={() => setShowUpgradePrompt(false)} className="w-full">
              Maybe Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Photo Button */}
      <Button 
        variant="warm" 
        className="w-full gap-2 h-12"
        onClick={handleAddPhotoClick}
      >
        <Plus className="w-5 h-5" />
        Add Photo
        {!isPremium && !canUploadMore && <Lock className="w-4 h-4 ml-1" />}
      </Button>

      {/* Add Photo Dialog */}
      <Dialog open={isCapturing} onOpenChange={setIsCapturing}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Add New Photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold mb-2 block">Body Part</label>
              <Select value={newPhotoBodyPart} onValueChange={(v) => setNewPhotoBodyPart(v as BodyPart)}>
                <SelectTrigger className="h-11 rounded-xl border-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bodyParts.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
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
            <input 
              type="file" 
              accept="image/*" 
              capture="environment"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button 
              variant="warm"
              className="w-full h-11 gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="w-5 h-5" />
              Take or Choose Photo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photos Grid - Virtualized with cursor-based pagination */}
      {isLoading && photos.length === 0 ? (
        <PhotoSkeleton count={4} />
      ) : photos.length === 0 ? (
        <div className="glass-card-warm p-8 text-center animate-fade-in relative overflow-hidden">
          <LeafIllustration variant="cluster" className="w-20 h-20 absolute -right-4 -bottom-4 opacity-15" />
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-coral/20 to-coral-light flex items-center justify-center relative">
            <Image className="w-8 h-8 text-coral" />
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

      {/* Photo Viewer Dialog - shows thumb instantly, upgrades to medium */}
      <Dialog open={!!viewingPhoto} onOpenChange={(open) => !open && setViewingPhoto(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Photo</DialogTitle>
            <DialogDescription>
              View your photo with a fast preview (thumbnail) and a higher quality version (medium).
            </DialogDescription>
          </DialogHeader>

          {viewingPhoto && (
            <>
              <div className="relative bg-black flex items-center justify-center">
                <ModalImage
                  thumbnailSrc={viewingPhoto.thumbnailUrl}
                  highResSrc={viewingPhoto.mediumUrl || viewingPhoto.originalUrl}
                  alt={`${viewingPhoto.bodyPart} photo`}
                />
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold bg-coral/10 text-coral px-3 py-1 rounded-full">
                    {bodyParts.find(b => b.value === viewingPhoto.bodyPart)?.label}
                  </span>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(viewingPhoto.timestamp), 'MMM d, yyyy')}
                  </p>
                </div>
                {viewingPhoto.notes && (
                  <p className="text-sm text-foreground">{viewingPhoto.notes}</p>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full mt-2"
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
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PhotoDiaryPage;
