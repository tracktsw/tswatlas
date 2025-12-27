import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getThumbnailPath } from "@/utils/imageCompression";

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
  /** Grid/timeline ONLY */
  thumbnailUrl: string;
  /** Fullscreen/compare ONLY (loaded on-demand) */
  mediumUrl?: string;
  bodyPart: BodyPart;
  timestamp: string;
  notes?: string;
}

interface PhotoRow {
  id: string;
  photo_url: string; // medium path stored in DB (legacy rows may be original jpg)
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

type ThumbCacheEntry = { url: string; expires: number };

type MediumCacheEntry = { path: string; url?: string; expires?: number };

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
  const thumbCacheRef = useRef<Map<string, ThumbCacheEntry>>(new Map());
  const mediumCacheRef = useRef<Map<string, MediumCacheEntry>>(new Map());

  // Prevent duplicate derivative requests
  const derivativeRequestedRef = useRef<Set<string>>(new Set());

  const cacheIsValid = (expires?: number) =>
    typeof expires === "number" && expires > Date.now();

  /**
   * IMPORTANT: For grid views, NEVER fall back to medium/original.
   * If a thumbnail is missing, we return an empty URL (grid shows placeholder).
   */
  const generateThumbnailUrls = useCallback(async (rows: PhotoRow[]) => {
    const now = Date.now();
    const results: VirtualPhoto[] = [];

    const toSign: { id: string; thumbPath: string; row: PhotoRow }[] = [];

    for (const row of rows) {
      // Remember medium path so fullscreen can be loaded on-demand later.
      mediumCacheRef.current.set(row.id, { path: row.photo_url });

      const cached = thumbCacheRef.current.get(row.id);
      if (cached && cached.expires > now) {
        results.push({
          id: row.id,
          thumbnailUrl: cached.url,
          bodyPart: row.body_part as BodyPart,
          timestamp: row.created_at,
          notes: row.notes || undefined,
        });
      } else {
        toSign.push({
          id: row.id,
          thumbPath: getThumbnailPath(row.photo_url),
          row,
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

        // Cache even empty results for a short period to avoid hammering.
        thumbCacheRef.current.set(id, {
          url,
          // if empty, retry sooner; otherwise 1h before expiry
          expires:
            url.length > 0
              ? now + (SIGNED_URL_DURATION - 3600) * 1000
              : now + 5 * 60 * 1000,
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
        .select("id, photo_url, body_part, created_at, notes")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (bodyPartFilter !== "all") {
        query = query.eq("body_part", bodyPartFilter);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        const photosWithThumbs = await generateThumbnailUrls(data);
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
  }, [userId, bodyPartFilter, generateThumbnailUrls]);

  const loadMore = useCallback(async () => {
    if (!userId || !hasMore || isLoadingMoreRef.current || !cursorRef.current) return;

    isLoadingMoreRef.current = true;

    try {
      let query = supabase
        .from("user_photos")
        .select("id, photo_url, body_part, created_at, notes")
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
        const photosWithThumbs = await generateThumbnailUrls(data);
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
  }, [userId, hasMore, bodyPartFilter, generateThumbnailUrls]);

  /**
   * On-demand medium URL signing (fullscreen/compare ONLY).
   */
  const fetchMediumUrl = useCallback(async (photoId: string) => {
    const cached = mediumCacheRef.current.get(photoId);
    if (!cached?.path) return "";

    if (cached.url && cacheIsValid(cached.expires)) {
      return cached.url;
    }

    const { data, error: signError } = await supabase.storage
      .from("user-photos")
      .createSignedUrl(cached.path, SIGNED_URL_DURATION);

    if (signError) throw signError;

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
          const url = await fetchMediumUrl(id);
          result.set(id, url);
        })
      );

      return result;
    },
    [fetchMediumUrl]
  );

  const addPhotoToList = useCallback((photo: VirtualPhoto) => {
    setPhotos((prev) => [photo, ...prev]);

    // Cache thumbnail URL to avoid refetch when scrolling back
    thumbCacheRef.current.set(photo.id, {
      url: photo.thumbnailUrl,
      expires: Date.now() + (SIGNED_URL_DURATION - 3600) * 1000,
    });
  }, []);

  const removePhotoFromList = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    thumbCacheRef.current.delete(id);
    mediumCacheRef.current.delete(id);
    derivativeRequestedRef.current.delete(id);
  }, []);

  // Background backfill: if we detect missing thumbnails, generate them server-side.
  useEffect(() => {
    const missing = photos
      .filter((p) => !p.thumbnailUrl)
      .map((p) => p.id)
      .filter((id) => !derivativeRequestedRef.current.has(id));

    if (missing.length === 0) return;

    const batch = missing.slice(0, 20);
    batch.forEach((id) => derivativeRequestedRef.current.add(id));

    supabase.functions
      .invoke("photo-derivatives", {
        body: { photoIds: batch },
      })
      .then(({ data, error: fnError }) => {
        if (fnError) throw fnError;

        const results: Array<{ id: string; thumbnailUrl: string; mediumUrl: string }> =
          data?.results ?? [];

        const now = Date.now();

        // Update caches + in-memory list (no refetch)
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
