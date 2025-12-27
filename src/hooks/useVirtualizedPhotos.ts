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
  /** Grid/timeline ONLY - stored in DB */
  thumbnailUrl: string;
  /** Fullscreen/compare ONLY - loaded on-demand from stored path */
  mediumUrl?: string;
  /** Original for export - never loaded by default */
  originalUrl?: string;
  bodyPart: BodyPart;
  timestamp: string;
  notes?: string;
}

interface PhotoRow {
  id: string;
  photo_url: string; // legacy field (medium path)
  thumb_url: string | null;
  medium_url: string | null;
  original_url: string | null;
  body_part: string;
  created_at: string;
  notes: string | null;
}

const PAGE_SIZE = 40;
const SIGNED_URL_DURATION = 60 * 60 * 24 * 30; // 30 days

interface UseVirtualizedPhotosOptions {
  userId: string | null;
  bodyPartFilter?: BodyPart | "all";
}

type CacheEntry = { url: string; expires: number };
type PathCacheEntry = { path: string; url?: string; expires?: number };

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

  // Caches to avoid refetching / re-signing
  const thumbCacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const mediumCacheRef = useRef<Map<string, PathCacheEntry>>(new Map());
  const originalCacheRef = useRef<Map<string, PathCacheEntry>>(new Map());

  // Track which photos need backfill
  const backfillRequestedRef = useRef<Set<string>>(new Set());

  const cacheIsValid = (expires?: number) =>
    typeof expires === "number" && expires > Date.now();

  /**
   * Generate signed URLs for thumbnails from explicit thumb_url column.
   * NEVER fall back to medium/original - grid must only show thumbnails.
   */
  const generateSignedUrls = useCallback(async (rows: PhotoRow[]) => {
    const now = Date.now();
    const results: VirtualPhoto[] = [];
    const toSign: { id: string; thumbPath: string; row: PhotoRow }[] = [];

    for (const row of rows) {
      // Store paths for on-demand medium/original fetching
      const mediumPath = row.medium_url || row.photo_url;
      const originalPath = row.original_url;
      
      mediumCacheRef.current.set(row.id, { path: mediumPath });
      if (originalPath) {
        originalCacheRef.current.set(row.id, { path: originalPath });
      }

      // Check thumb cache first
      const cached = thumbCacheRef.current.get(row.id);
      if (cached && cached.expires > now) {
        results.push({
          id: row.id,
          thumbnailUrl: cached.url,
          bodyPart: row.body_part as BodyPart,
          timestamp: row.created_at,
          notes: row.notes || undefined,
        });
      } else if (row.thumb_url) {
        // Has explicit thumb_url - sign it
        toSign.push({
          id: row.id,
          thumbPath: row.thumb_url,
          row,
        });
      } else {
        // No thumbnail available - will trigger backfill
        results.push({
          id: row.id,
          thumbnailUrl: "", // Empty = placeholder shown
          bodyPart: row.body_part as BodyPart,
          timestamp: row.created_at,
          notes: row.notes || undefined,
        });
      }
    }

    if (toSign.length) {
      const paths = toSign.map((x) => x.thumbPath);
      const { data: signed, error: signError } = await supabase.storage
        .from("user-photos")
        .createSignedUrls(paths, SIGNED_URL_DURATION);

      if (signError) throw signError;

      for (let i = 0; i < toSign.length; i++) {
        const { id, row } = toSign[i];
        const url = signed?.[i]?.signedUrl || "";

        thumbCacheRef.current.set(id, {
          url,
          expires: url ? now + (SIGNED_URL_DURATION - 3600) * 1000 : now + 5 * 60 * 1000,
        });

        results.push({
          id,
          thumbnailUrl: url,
          bodyPart: row.body_part as BodyPart,
          timestamp: row.created_at,
          notes: row.notes || undefined,
        });
      }
    }

    // Preserve original ordering
    const order = rows.map((r) => r.id);
    return results.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
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
        const photosWithThumbs = await generateSignedUrls(data as PhotoRow[]);
        setPhotos(photosWithThumbs);
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
  }, [userId, bodyPartFilter, generateSignedUrls]);

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
        const photosWithThumbs = await generateSignedUrls(data as PhotoRow[]);
        setPhotos((prev) => [...prev, ...photosWithThumbs]);
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
  }, [userId, hasMore, bodyPartFilter, generateSignedUrls]);

  /**
   * On-demand medium URL signing (fullscreen/compare ONLY).
   * Falls back to original if medium fails.
   */
  const fetchMediumUrl = useCallback(async (photoId: string): Promise<string> => {
    const cached = mediumCacheRef.current.get(photoId);
    if (!cached?.path) return "";

    if (cached.url && cacheIsValid(cached.expires)) {
      return cached.url;
    }

    const { data, error: signError } = await supabase.storage
      .from("user-photos")
      .createSignedUrl(cached.path, SIGNED_URL_DURATION);

    if (signError) {
      // Try original as fallback
      const originalCached = originalCacheRef.current.get(photoId);
      if (originalCached?.path) {
        const { data: origData } = await supabase.storage
          .from("user-photos")
          .createSignedUrl(originalCached.path, SIGNED_URL_DURATION);
        if (origData?.signedUrl) return origData.signedUrl;
      }
      throw signError;
    }

    const url = data?.signedUrl || "";
    mediumCacheRef.current.set(photoId, {
      path: cached.path,
      url,
      expires: Date.now() + (SIGNED_URL_DURATION - 3600) * 1000,
    });

    return url;
  }, []);

  const prefetchMediumUrls = useCallback(
    async (photoIds: string[]) => {
      const unique = Array.from(new Set(photoIds)).filter(Boolean);
      const result = new Map<string, string>();
      if (!unique.length) return result;

      await Promise.all(
        unique.map(async (id) => {
          try {
            const url = await fetchMediumUrl(id);
            result.set(id, url);
          } catch {
            // Keep empty, will show thumbnail
          }
        })
      );

      return result;
    },
    [fetchMediumUrl]
  );

  const addPhotoToList = useCallback((photo: VirtualPhoto) => {
    setPhotos((prev) => [photo, ...prev]);

    // Cache thumbnail URL
    if (photo.thumbnailUrl) {
      thumbCacheRef.current.set(photo.id, {
        url: photo.thumbnailUrl,
        expires: Date.now() + (SIGNED_URL_DURATION - 3600) * 1000,
      });
    }
  }, []);

  const removePhotoFromList = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    thumbCacheRef.current.delete(id);
    mediumCacheRef.current.delete(id);
    originalCacheRef.current.delete(id);
    backfillRequestedRef.current.delete(id);
  }, []);

  // Background backfill: if we detect missing thumbnails, generate them server-side.
  useEffect(() => {
    const missing = photos
      .filter((p) => !p.thumbnailUrl)
      .map((p) => p.id)
      .filter((id) => !backfillRequestedRef.current.has(id));

    if (missing.length === 0) return;

    const batch = missing.slice(0, 20);
    batch.forEach((id) => backfillRequestedRef.current.add(id));

    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      return supabase.functions.invoke("photo-derivatives", {
        body: { photoIds: batch },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    })
      .then(({ data, error: fnError }) => {
        if (fnError) throw fnError;

        const results: Array<{ id: string; thumbnailUrl: string; mediumUrl: string }> =
          data?.results ?? [];

        const now = Date.now();

        // Update caches + in-memory list
        for (const r of results) {
          if (r.thumbnailUrl) {
            thumbCacheRef.current.set(r.id, {
              url: r.thumbnailUrl,
              expires: now + (SIGNED_URL_DURATION - 3600) * 1000,
            });
          }

          if (r.mediumUrl) {
            const cached = mediumCacheRef.current.get(r.id);
            if (cached?.path) {
              mediumCacheRef.current.set(r.id, {
                ...cached,
                url: r.mediumUrl,
                expires: now + (SIGNED_URL_DURATION - 3600) * 1000,
              });
            }
          }
        }

        setPhotos((prev) =>
          prev.map((p) => {
            const found = results.find((x) => x.id === p.id);
            if (!found) return p;
            return {
              ...p,
              thumbnailUrl: found.thumbnailUrl || p.thumbnailUrl,
              mediumUrl: found.mediumUrl || p.mediumUrl,
            };
          })
        );
      })
      .catch((e) => {
        console.warn("Derivative generation failed", e);
      });
  }, [photos]);

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
