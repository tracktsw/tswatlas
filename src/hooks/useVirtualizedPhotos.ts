import { useState, useEffect, useCallback, useRef } from "react";
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

export interface VirtualPhoto {
  id: string;
  /** Grid/timeline ONLY - public URL stored in DB */
  thumbnailUrl: string;
  /** Fullscreen/compare ONLY - public URL stored in DB */
  mediumUrl?: string;
  /** Original for export - public URL stored in DB */
  originalUrl?: string;
  bodyPart: BodyPart;
  timestamp: string;
  notes?: string;
}

interface PhotoRow {
  id: string;
  photo_url: string; // legacy field
  thumb_url: string | null;
  medium_url: string | null;
  original_url: string | null;
  body_part: string;
  created_at: string;
  notes: string | null;
}

const PAGE_SIZE = 40;

interface UseVirtualizedPhotosOptions {
  userId: string | null;
  bodyPartFilter?: BodyPart | "all";
}

export const useVirtualizedPhotos = ({
  userId,
  bodyPartFilter = "all",
}: UseVirtualizedPhotosOptions) => {
  const [photos, setPhotos] = useState<VirtualPhoto[]>([]);
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
      timestamp: row.created_at,
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
      let query = supabase
        .from("user_photos")
        .select("id, photo_url, thumb_url, medium_url, original_url, body_part, created_at, notes")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (bodyPartFilter !== "all") {
        query = query.eq("body_part", bodyPartFilter);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        const photosWithUrls = transformRows(data as PhotoRow[]);
        setPhotos(photosWithUrls);
        cursorRef.current = data[data.length - 1].created_at;
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
  }, [userId, bodyPartFilter, transformRows]);

  const loadMore = useCallback(async () => {
    if (!userId || !hasMore || isLoadingMoreRef.current || !cursorRef.current) return;

    isLoadingMoreRef.current = true;

    try {
      let query = supabase
        .from("user_photos")
        .select("id, photo_url, thumb_url, medium_url, original_url, body_part, created_at, notes")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .lt("created_at", cursorRef.current)
        .limit(PAGE_SIZE);

      if (bodyPartFilter !== "all") {
        query = query.eq("body_part", bodyPartFilter);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        const photosWithUrls = transformRows(data as PhotoRow[]);
        setPhotos((prev) => [...prev, ...photosWithUrls]);
        cursorRef.current = data[data.length - 1].created_at;
        setHasMore(data.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Error loading more photos:", err);
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, [userId, hasMore, bodyPartFilter, transformRows]);

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
    setPhotos((prev) => [photo, ...prev]);
  }, []);

  const removePhotoFromList = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  return {
    photos,
    isLoading,
    hasMore,
    error,
    loadMore,
    addPhotoToList,
    removePhotoFromList,
    fetchMediumUrl,
    prefetchMediumUrls,
    totalCount: photos.length,
    refresh: loadPhotos,
  };
};
