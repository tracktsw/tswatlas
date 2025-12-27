import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getThumbnailPath } from '@/utils/imageCompression';

export type BodyPart = 'face' | 'neck' | 'arms' | 'hands' | 'legs' | 'feet' | 'torso' | 'back';

export interface VirtualPhoto {
  id: string;
  thumbnailUrl: string;
  mediumUrl: string;
  bodyPart: BodyPart;
  timestamp: string;
  notes?: string;
}

interface PhotoRow {
  id: string;
  photo_url: string;
  body_part: string;
  created_at: string;
  notes: string | null;
}

const PAGE_SIZE = 40;
const SIGNED_URL_DURATION = 60 * 60 * 24 * 30; // 30 days

interface UseVirtualizedPhotosOptions {
  userId: string | null;
  bodyPartFilter?: BodyPart | 'all';
}

export const useVirtualizedPhotos = ({ userId, bodyPartFilter = 'all' }: UseVirtualizedPhotosOptions) => {
  const [photos, setPhotos] = useState<VirtualPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Cursor for pagination - use timestamp for stable ordering
  const cursorRef = useRef<string | null>(null);
  const isLoadingMoreRef = useRef(false);
  
  // Cache for signed URLs to avoid regenerating
  const urlCacheRef = useRef<Map<string, { thumbnail: string; medium: string; expires: number }>>(new Map());

  // Generate signed URLs with caching
  const generateSignedUrls = useCallback(async (photoRows: PhotoRow[]): Promise<VirtualPhoto[]> => {
    const now = Date.now();
    const results: VirtualPhoto[] = [];
    const pathsToSign: { photoId: string; mediumPath: string; thumbPath: string }[] = [];

    // Check cache first
    for (const row of photoRows) {
      const cached = urlCacheRef.current.get(row.id);
      if (cached && cached.expires > now) {
        results.push({
          id: row.id,
          thumbnailUrl: cached.thumbnail,
          mediumUrl: cached.medium,
          bodyPart: row.body_part as BodyPart,
          timestamp: row.created_at,
          notes: row.notes || undefined,
        });
      } else {
        pathsToSign.push({
          photoId: row.id,
          mediumPath: row.photo_url,
          thumbPath: getThumbnailPath(row.photo_url),
        });
      }
    }

    if (pathsToSign.length > 0) {
      // Batch sign all paths
      const allPaths = pathsToSign.flatMap(p => [p.mediumPath, p.thumbPath]);
      const { data: signedUrls, error } = await supabase.storage
        .from('user-photos')
        .createSignedUrls(allPaths, SIGNED_URL_DURATION);

      if (error) {
        console.error('Error generating signed URLs:', error);
        throw error;
      }

      // Map signed URLs back to photos
      for (let i = 0; i < pathsToSign.length; i++) {
        const { photoId, mediumPath, thumbPath } = pathsToSign[i];
        const mediumUrl = signedUrls?.[i * 2]?.signedUrl || '';
        const thumbnailUrl = signedUrls?.[i * 2 + 1]?.signedUrl || mediumUrl;
        
        const row = photoRows.find(r => r.id === photoId)!;
        
        // Cache the URLs (expires 1 hour before actual expiry)
        urlCacheRef.current.set(photoId, {
          thumbnail: thumbnailUrl,
          medium: mediumUrl,
          expires: now + (SIGNED_URL_DURATION - 3600) * 1000,
        });

        results.push({
          id: row.id,
          thumbnailUrl,
          mediumUrl,
          bodyPart: row.body_part as BodyPart,
          timestamp: row.created_at,
          notes: row.notes || undefined,
        });
      }
    }

    // Sort by original order
    const idOrder = photoRows.map(r => r.id);
    return results.sort((a, b) => idOrder.indexOf(a.id) - idOrder.indexOf(b.id));
  }, []);

  // Initial load
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
        .from('user_photos')
        .select('id, photo_url, body_part, created_at, notes')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (bodyPartFilter !== 'all') {
        query = query.eq('body_part', bodyPartFilter);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        const photosWithUrls = await generateSignedUrls(data);
        setPhotos(photosWithUrls);
        cursorRef.current = data[data.length - 1].created_at;
        setHasMore(data.length === PAGE_SIZE);
      } else {
        setPhotos([]);
        setHasMore(false);
      }
    } catch (err) {
      setError(err as Error);
      console.error('Error loading photos:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, bodyPartFilter, generateSignedUrls]);

  // Load more (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!userId || !hasMore || isLoadingMoreRef.current || !cursorRef.current) {
      return;
    }

    isLoadingMoreRef.current = true;

    try {
      let query = supabase
        .from('user_photos')
        .select('id, photo_url, body_part, created_at, notes')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .lt('created_at', cursorRef.current)
        .limit(PAGE_SIZE);

      if (bodyPartFilter !== 'all') {
        query = query.eq('body_part', bodyPartFilter);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        const photosWithUrls = await generateSignedUrls(data);
        setPhotos(prev => [...prev, ...photosWithUrls]);
        cursorRef.current = data[data.length - 1].created_at;
        setHasMore(data.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more photos:', err);
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, [userId, hasMore, bodyPartFilter, generateSignedUrls]);

  // Add new photo to the list
  const addPhotoToList = useCallback((photo: VirtualPhoto) => {
    setPhotos(prev => [photo, ...prev]);
    // Cache the URLs
    urlCacheRef.current.set(photo.id, {
      thumbnail: photo.thumbnailUrl,
      medium: photo.mediumUrl,
      expires: Date.now() + (SIGNED_URL_DURATION - 3600) * 1000,
    });
  }, []);

  // Remove photo from list
  const removePhotoFromList = useCallback((id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
    urlCacheRef.current.delete(id);
  }, []);

  // Get medium URL for a photo (for fullscreen/compare)
  const getMediumUrl = useCallback((photoId: string): string => {
    const cached = urlCacheRef.current.get(photoId);
    if (cached) return cached.medium;
    const photo = photos.find(p => p.id === photoId);
    return photo?.mediumUrl || '';
  }, [photos]);

  // Reload on filter change or user change
  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // Total count for UI
  const totalCount = photos.length;

  return {
    photos,
    isLoading,
    hasMore,
    error,
    loadMore,
    addPhotoToList,
    removePhotoFromList,
    getMediumUrl,
    totalCount,
    refresh: loadPhotos,
  };
};
