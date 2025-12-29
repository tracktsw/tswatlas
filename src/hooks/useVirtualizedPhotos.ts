import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BodyPart =
  | "face"
  | "neck"
  | "arms"
  | "hands"
  | "legs"
  | "feet"
  | "torso"
  | "back";

export type SortOrder = "newest" | "oldest";

export interface VirtualPhoto {
  id: string;
  /** Grid/timeline ONLY - public URL stored in DB */
  thumbnailUrl: string;
  /** Fullscreen/compare ONLY - public URL stored in DB */
  mediumUrl?: string;
  /** Original for export - public URL stored in DB */
  originalUrl?: string;
  bodyPart: BodyPart;
  /** When photo was taken (EXIF date) - preferred for display */
  takenAt: string | null;
  /** When photo was uploaded to the app */
  uploadedAt: string;
  /** Computed: takenAt if available, otherwise uploadedAt */
  timestamp: string;
  notes?: string;
  /** True if this is an optimistic placeholder (upload in progress) */
  isOptimistic?: boolean;
  /** Object URL for cleanup (optimistic photos only) */
  objectUrl?: string;
}

interface PhotoRow {
  id: string;
  photo_url: string; // legacy field
  thumb_url: string | null;
  medium_url: string | null;
  original_url: string | null;
  body_part: string;
  created_at: string;
  taken_at: string | null;
  notes: string | null;
}

const PAGE_SIZE = 40;

interface UseVirtualizedPhotosOptions {
  userId: string | null;
  bodyPartFilter?: BodyPart | "all";
  sortOrder?: SortOrder;
}

export const useVirtualizedPhotos = ({
  userId,
  bodyPartFilter = "all",
  sortOrder = "newest",
}: UseVirtualizedPhotosOptions) => {
  const [photos, setPhotos] = useState<VirtualPhoto[]>([]);
  const [optimisticPhotos, setOptimisticPhotos] = useState<VirtualPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Cursor for pagination (stable ordering)
  const cursorRef = useRef<string | null>(null);
  const isLoadingMoreRef = useRef(false);

  /**
   * Transform DB rows to VirtualPhoto objects.
   * Uses stored public URLs directly - no signing needed for public bucket.
   */
  const transformRows = useCallback((rows: PhotoRow[]): VirtualPhoto[] => {
    return rows.map((row) => ({
      id: row.id,
      // Use stored public URLs directly - grid only shows thumbnails
      thumbnailUrl: row.thumb_url || row.medium_url || row.photo_url || "",
      // Medium for fullscreen/compare - fallback chain
      mediumUrl: row.medium_url || row.photo_url || undefined,
      // Original for export
      originalUrl: row.original_url || undefined,
      bodyPart: row.body_part as BodyPart,
      // EXIF date (when photo was actually taken)
      takenAt: row.taken_at,
      // Upload date
      uploadedAt: row.created_at,
      // Display date: prefer takenAt, fall back to uploadedAt
      timestamp: row.taken_at || row.created_at,
      notes: row.notes || undefined,
    }));
  }, []);

  const loadPhotos = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    cursorRef.current = null;

    try {
      // Sort by taken_at (EXIF/capture date) first, fall back to created_at for photos without taken_at
      // nullsFirst=false for both orders: photos with dates always come before photos without dates
      const isAscending = sortOrder === "oldest";
      
      let query = supabase
        .from("user_photos")
        .select("id, photo_url, thumb_url, medium_url, original_url, body_part, created_at, taken_at, notes")
        .eq("user_id", userId)
        // Primary sort: taken_at with nulls last (photos with dates first)
        .order("taken_at", { ascending: isAscending, nullsFirst: false })
        // Secondary sort for tie-breaking within same taken_at or for null taken_at photos
        .order("created_at", { ascending: isAscending })
        // Tertiary sort by id for absolute stability
        .order("id", { ascending: isAscending })
        .limit(PAGE_SIZE);

      if (bodyPartFilter !== "all") {
        query = query.eq("body_part", bodyPartFilter);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        const photosWithUrls = transformRows(data as PhotoRow[]);
        setPhotos(photosWithUrls);
        // Use the last photo's composite cursor for pagination
        const lastPhoto = data[data.length - 1];
        cursorRef.current = lastPhoto.taken_at || lastPhoto.created_at;
        setHasMore(data.length === PAGE_SIZE);
      } else {
        setPhotos([]);
        setHasMore(false);
      }
    } catch (err) {
      setError(err as Error);
      console.error("Error loading photos:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, bodyPartFilter, sortOrder, transformRows]);

  const loadMore = useCallback(async () => {
    if (!userId || !hasMore || isLoadingMoreRef.current || !cursorRef.current) return;

    isLoadingMoreRef.current = true;

    try {
      const isAscending = sortOrder === "oldest";
      
      let query = supabase
        .from("user_photos")
        .select("id, photo_url, thumb_url, medium_url, original_url, body_part, created_at, taken_at, notes")
        .eq("user_id", userId)
        // Same ordering as initial load
        .order("taken_at", { ascending: isAscending, nullsFirst: false })
        .order("created_at", { ascending: isAscending })
        .order("id", { ascending: isAscending });

      // For pagination, filter based on cursor
      // This handles both photos with taken_at and those falling back to created_at
      if (isAscending) {
        query = query.or(`taken_at.gt.${cursorRef.current},and(taken_at.is.null,created_at.gt.${cursorRef.current})`);
      } else {
        query = query.or(`taken_at.lt.${cursorRef.current},and(taken_at.is.null,created_at.lt.${cursorRef.current})`);
      }

      if (bodyPartFilter !== "all") {
        query = query.eq("body_part", bodyPartFilter);
      }

      query = query.limit(PAGE_SIZE);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        const photosWithUrls = transformRows(data as PhotoRow[]);
        setPhotos((prev) => [...prev, ...photosWithUrls]);
        const lastPhoto = data[data.length - 1];
        cursorRef.current = lastPhoto.taken_at || lastPhoto.created_at;
        setHasMore(data.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Error loading more photos:", err);
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, [userId, hasMore, bodyPartFilter, sortOrder, transformRows]);

  /**
   * Get medium URL for fullscreen/compare.
   * Since URLs are now stored directly, this just returns the cached mediumUrl.
   * Falls back to originalUrl if medium is missing.
   */
  const fetchMediumUrl = useCallback(async (photoId: string): Promise<string> => {
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return "";
    return photo.mediumUrl || photo.originalUrl || photo.thumbnailUrl || "";
  }, [photos]);

  const prefetchMediumUrls = useCallback(
    async (photoIds: string[]) => {
      const result = new Map<string, string>();
      for (const id of photoIds) {
        const photo = photos.find((p) => p.id === id);
        if (photo) {
          result.set(id, photo.mediumUrl || photo.originalUrl || photo.thumbnailUrl || "");
        }
      }
      return result;
    },
    [photos]
  );

  const addPhotoToList = useCallback((photo: VirtualPhoto) => {
    // Insert at correct position based on sort order
    setPhotos((prev) => {
      const newTimestamp = new Date(photo.timestamp).getTime();
      if (sortOrder === "newest") {
        // For newest first, new photos go at the start if they're the most recent
        const insertIndex = prev.findIndex(p => new Date(p.timestamp).getTime() < newTimestamp);
        if (insertIndex === -1) {
          return [...prev, photo];
        }
        return [...prev.slice(0, insertIndex), photo, ...prev.slice(insertIndex)];
      } else {
        // For oldest first, new photos go at the end if they're the most recent
        const insertIndex = prev.findIndex(p => new Date(p.timestamp).getTime() > newTimestamp);
        if (insertIndex === -1) {
          return [...prev, photo];
        }
        return [...prev.slice(0, insertIndex), photo, ...prev.slice(insertIndex)];
      }
    });
  }, [sortOrder]);

  const removePhotoFromList = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    // Also remove from optimistic if present
    setOptimisticPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  /**
   * Add an optimistic placeholder photo that appears instantly in the grid.
   * Returns the temporary ID for later resolution.
   */
  const addOptimisticPhoto = useCallback((
    file: File, 
    bodyPart: BodyPart, 
    timestamp: string
  ): string => {
    const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const objectUrl = URL.createObjectURL(file);
    
    const optimisticPhoto: VirtualPhoto = {
      id: tempId,
      thumbnailUrl: objectUrl,
      bodyPart,
      takenAt: timestamp,
      uploadedAt: new Date().toISOString(),
      timestamp,
      isOptimistic: true,
      objectUrl,
    };
    
    setOptimisticPhotos((prev) => [optimisticPhoto, ...prev]);
    return tempId;
  }, []);

  /**
   * Replace an optimistic placeholder with the real uploaded photo.
   * Cleans up the object URL to free memory.
   */
  const resolveOptimisticPhoto = useCallback((tempId: string, realPhoto?: VirtualPhoto) => {
    setOptimisticPhotos((prev) => {
      const optimistic = prev.find((p) => p.id === tempId);
      if (optimistic?.objectUrl) {
        URL.revokeObjectURL(optimistic.objectUrl);
      }
      return prev.filter((p) => p.id !== tempId);
    });
    
    // Add the real photo to the list if provided
    if (realPhoto) {
      setPhotos((prev) => {
        const newTimestamp = new Date(realPhoto.timestamp).getTime();
        if (sortOrder === "newest") {
          const insertIndex = prev.findIndex(p => new Date(p.timestamp).getTime() < newTimestamp);
          if (insertIndex === -1) {
            return [...prev, realPhoto];
          }
          return [...prev.slice(0, insertIndex), realPhoto, ...prev.slice(insertIndex)];
        } else {
          const insertIndex = prev.findIndex(p => new Date(p.timestamp).getTime() > newTimestamp);
          if (insertIndex === -1) {
            return [...prev, realPhoto];
          }
          return [...prev.slice(0, insertIndex), realPhoto, ...prev.slice(insertIndex)];
        }
      });
    }
  }, [sortOrder]);

  /**
   * Remove an optimistic photo (e.g., on upload error).
   * Cleans up the object URL.
   */
  const removeOptimisticPhoto = useCallback((tempId: string) => {
    setOptimisticPhotos((prev) => {
      const optimistic = prev.find((p) => p.id === tempId);
      if (optimistic?.objectUrl) {
        URL.revokeObjectURL(optimistic.objectUrl);
      }
      return prev.filter((p) => p.id !== tempId);
    });
  }, []);

  // Merge optimistic photos with real photos (optimistic first, then sorted real photos)
  const allPhotos = useMemo(() => {
    // Filter optimistic photos by body part if needed
    const filteredOptimistic = bodyPartFilter === "all" 
      ? optimisticPhotos 
      : optimisticPhotos.filter(p => p.bodyPart === bodyPartFilter);
    
    return [...filteredOptimistic, ...photos];
  }, [optimisticPhotos, photos, bodyPartFilter]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  return {
    photos: allPhotos,
    isLoading,
    hasMore,
    error,
    loadMore,
    addPhotoToList,
    removePhotoFromList,
    addOptimisticPhoto,
    resolveOptimisticPhoto,
    removeOptimisticPhoto,
    fetchMediumUrl,
    prefetchMediumUrls,
    totalCount: allPhotos.length,
    refresh: loadPhotos,
  };
};
