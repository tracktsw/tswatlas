import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { processImageForUpload, getPublicUrl } from '@/utils/imageCompression';
import { BodyPart } from '@/contexts/UserDataContext';
import { isHeicFile, prepareFileForUpload } from '@/utils/heicConverter';
import { extractExifDate } from '@/utils/exifExtractor';
import { startOfDay, endOfDay } from 'date-fns';

const FREE_DAILY_PHOTO_LIMIT = 2;

export interface UploadItem {
  id: string;
  file: File;
  status: 'pending' | 'converting' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  photoId?: string;
  isHeic?: boolean;
}

interface UseBatchUploadOptions {
  concurrency?: number;
  onPhotoUploaded?: (photoId: string) => void;
  onComplete?: (results: { success: number; failed: number; limitReached?: boolean }) => void;
  /** Called when daily limit is reached */
  onLimitReached?: () => void;
  /** Skip the daily limit check (for premium users) */
  skipLimitCheck?: boolean;
}

export const useBatchUpload = (options: UseBatchUploadOptions = {}) => {
  const { concurrency = 2, onPhotoUploaded, onComplete, onLimitReached, skipLimitCheck } = options;
  
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [bodyPart, setBodyPart] = useState<BodyPart>('face');
  const cancelledRef = useRef(false);
  const activeUploadsRef = useRef(0);
  // Track successful uploads in current batch for limit checking
  const batchSuccessCountRef = useRef(0);

  // Server-side check for daily upload limit
  const checkDailyLimit = useCallback(async (userId: string): Promise<number> => {
    const today = new Date();
    const dayStart = startOfDay(today).toISOString();
    const dayEnd = endOfDay(today).toISOString();

    const { count, error } = await supabase
      .from('user_photos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd);

    if (error) {
      console.error('[BatchUpload] Error checking daily limit:', error);
      return 0; // Assume 0 on error (fail open)
    }

    return count || 0;
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<UploadItem>) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  const uploadSinglePhoto = async (item: UploadItem, userId: string): Promise<boolean> => {
    if (cancelledRef.current) return false;

    if (import.meta.env.DEV) {
      console.log('[BatchUpload] Starting upload for:', item.file.name, 'isHeic:', item.isHeic);
    }

    let uploadedPaths: string[] = [];

    try {
      // Extract EXIF date from ORIGINAL file BEFORE any conversion
      // (HEIC conversion strips metadata, so we must do this first)
      // Returns timezone-less "YYYY-MM-DDTHH:MM:SS" or null
      const exifDate = await extractExifDate(item.file);
      const dateSource = exifDate ? 'exif' : 'upload_fallback';
      
      if (import.meta.env.DEV) {
        console.log('[BatchUpload] Date info for', item.file.name + ':', {
          taken_at: exifDate || null,
          date_source: dateSource,
          exif_present: !!exifDate,
        });
      }

      // Convert HEIC if needed
      if (item.isHeic) {
        updateItem(item.id, { status: 'converting', progress: 5 });
        if (import.meta.env.DEV) {
          console.log('[BatchUpload] Converting HEIC:', item.file.name);
        }
      }

      // Prepare file (converts HEIC if needed, returns data URL)
      let dataUrl: string;
      try {
        dataUrl = await prepareFileForUpload(item.file);
        console.log('[BatchUpload] File conversion successful:', item.file.name, 'data URL length:', dataUrl.length);
      } catch (conversionError) {
        const msg = conversionError instanceof Error ? conversionError.message : 'File conversion failed';
        console.error('[BatchUpload] File conversion failed:', item.file.name, '-', msg);
        throw new Error(`Could not process image: ${msg}`);
      }
      
      updateItem(item.id, { status: 'uploading', progress: 20 });

      if (cancelledRef.current) return false;

      // Process image (generate thumb, medium, original)
      const processed = await processImageForUpload(dataUrl, userId);
      updateItem(item.id, { progress: 50 });

      if (cancelledRef.current) return false;

      // Upload all versions in parallel
      const [thumbResult, mediumResult, originalResult] = await Promise.all([
        supabase.storage
          .from('photos')
          .upload(processed.thumbnail.path, processed.thumbnail.blob, {
            contentType: 'image/webp',
            cacheControl: '31536000',
          }),
        supabase.storage
          .from('photos')
          .upload(processed.medium.path, processed.medium.blob, {
            contentType: 'image/webp',
            cacheControl: '31536000',
          }),
        supabase.storage
          .from('photos')
          .upload(processed.original.path, processed.original.blob, {
            contentType: 'image/jpeg',
          }),
      ]);

      updateItem(item.id, { progress: 80 });

      // Track uploads for cleanup
      if (!thumbResult.error) uploadedPaths.push(processed.thumbnail.path);
      if (!mediumResult.error) uploadedPaths.push(processed.medium.path);
      if (!originalResult.error) uploadedPaths.push(processed.original.path);

      if (thumbResult.error) {
        const errMsg = thumbResult.error.message || 'Thumbnail upload failed';
        if (import.meta.env.DEV) console.error('[BatchUpload] Thumb error:', errMsg);
        throw new Error(errMsg);
      }
      if (mediumResult.error) {
        const errMsg = mediumResult.error.message || 'Image upload failed';
        if (import.meta.env.DEV) console.error('[BatchUpload] Medium error:', errMsg);
        throw new Error(errMsg);
      }

      if (cancelledRef.current) {
        // Cleanup on cancel
        if (uploadedPaths.length > 0) {
          await supabase.storage.from('photos').remove(uploadedPaths);
        }
        return false;
      }

      // Generate public URLs
      const thumbUrl = getPublicUrl(processed.thumbnail.path);
      const mediumUrl = getPublicUrl(processed.medium.path);
      const originalUrl = !originalResult.error ? getPublicUrl(processed.original.path) : null;

      // Insert database record
      // - taken_at = EXIF date (when photo was actually taken)
      // - created_at = auto-set by database (when uploaded)
      const { data: insertedPhoto, error: insertError } = await supabase
        .from('user_photos')
        .insert({
          user_id: userId,
          body_part: bodyPart,
          photo_url: mediumUrl,
          thumb_url: thumbUrl,
          medium_url: mediumUrl,
          original_url: originalUrl,
          notes: null,
          taken_at: exifDate || null,
        })
        .select()
        .single();

      if (insertError) {
        const errMsg = insertError.message || 'Database error';
        if (import.meta.env.DEV) console.error('[BatchUpload] DB error:', errMsg);
        throw new Error(errMsg);
      }

      if (import.meta.env.DEV) {
        console.log('[BatchUpload] Upload complete:', {
          photo_id: insertedPhoto.id,
          file_name: item.file.name,
          taken_at: exifDate || null,
          date_source: dateSource,
          exif_present: !!exifDate,
        });
      }

      updateItem(item.id, { status: 'success', progress: 100, photoId: insertedPhoto.id });
      onPhotoUploaded?.(insertedPhoto.id);
      return true;
    } catch (error) {
      // Cleanup on error
      if (uploadedPaths.length > 0) {
        try {
          await supabase.storage.from('photos').remove(uploadedPaths);
        } catch {}
      }
      
      const message = error instanceof Error ? error.message : 'Upload failed';
      if (import.meta.env.DEV) {
        console.error('[BatchUpload] Upload failed for:', item.file.name, '-', message);
      }
      updateItem(item.id, { status: 'error', progress: 0, error: message });
      return false;
    }
  };

  // Sequential processing for iOS safety - no Promise.all race conditions
  // Also checks limit before each upload for free users
  const processQueue = async (queue: UploadItem[], userId: string, initialPhotosToday: number) => {
    let successCount = 0;
    let failedCount = 0;
    let limitReached = false;

    for (const item of queue) {
      if (cancelledRef.current) break;

      if (item.status === 'success') {
        successCount++;
        continue;
      }

      // Check limit before each upload (for free users)
      if (!skipLimitCheck) {
        const currentPhotosToday = initialPhotosToday + batchSuccessCountRef.current;
        if (currentPhotosToday >= FREE_DAILY_PHOTO_LIMIT) {
          if (import.meta.env.DEV) {
            console.log('[BatchUpload] Daily limit reached, stopping uploads');
          }
          limitReached = true;
          // Mark remaining items as errors with limit message
          updateItem(item.id, { status: 'error', progress: 0, error: 'Daily limit reached' });
          failedCount++;
          continue;
        }
      }

      // Process one at a time - iOS is more reliable this way
      const success = await uploadSinglePhoto(item, userId);

      if (success) {
        successCount++;
        batchSuccessCountRef.current++;
      } else {
        failedCount++;
      }
    }

    return { success: successCount, failed: failedCount, limitReached };
  };

  const startUpload = useCallback(async (files: File[]) => {
    if (import.meta.env.DEV) {
      console.log('[BatchUpload] startUpload called with', files.length, 'files');
    }
    
    if (files.length === 0) {
      if (import.meta.env.DEV) {
        console.warn('[BatchUpload] startUpload called with empty files array');
      }
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (import.meta.env.DEV) {
        console.error('[BatchUpload] User not authenticated');
      }
      throw new Error('Not authenticated');
    }

    if (import.meta.env.DEV) {
      console.log('[BatchUpload] Authenticated user:', user.id);
    }

    cancelledRef.current = false;
    batchSuccessCountRef.current = 0;
    setIsUploading(true);

    // Check current daily count before starting (for free users)
    let initialPhotosToday = 0;
    if (!skipLimitCheck) {
      initialPhotosToday = await checkDailyLimit(user.id);
      if (initialPhotosToday >= FREE_DAILY_PHOTO_LIMIT) {
        if (import.meta.env.DEV) {
          console.log('[BatchUpload] Daily limit already reached');
        }
        setIsUploading(false);
        onLimitReached?.();
        return { success: 0, failed: files.length, limitReached: true };
      }
    }

    // Create upload items with HEIC detection
    const newItems: UploadItem[] = files.map((file, index) => ({
      id: `upload-${Date.now()}-${index}`,
      file,
      status: 'pending' as const,
      progress: 0,
      isHeic: isHeicFile(file),
    }));

    const heicCount = newItems.filter(i => i.isHeic).length;
    if (import.meta.env.DEV) {
      console.log('[BatchUpload] Created upload items:', newItems.map(i => i.file.name));
      console.log('[BatchUpload] HEIC files detected:', heicCount);
    }

    setItems(newItems);

    // Process queue
    const results = await processQueue(newItems, user.id, initialPhotosToday);
    
    if (import.meta.env.DEV) {
      console.log('[BatchUpload] Upload complete. Success:', results.success, 'Failed:', results.failed, 'LimitReached:', results.limitReached);
    }
    
    if (results.limitReached) {
      onLimitReached?.();
    }
    
    setIsUploading(false);
    onComplete?.(results);

    return results;
  }, [bodyPart, concurrency, onComplete, onPhotoUploaded, skipLimitCheck, checkDailyLimit, onLimitReached]);

  const retryFailed = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const failedItems = items.filter(item => item.status === 'error');
    if (failedItems.length === 0) return;

    cancelledRef.current = false;
    batchSuccessCountRef.current = 0;
    setIsUploading(true);

    // Check current daily count before retrying (for free users)
    let initialPhotosToday = 0;
    if (!skipLimitCheck) {
      initialPhotosToday = await checkDailyLimit(user.id);
      if (initialPhotosToday >= FREE_DAILY_PHOTO_LIMIT) {
        setIsUploading(false);
        onLimitReached?.();
        return { success: 0, failed: failedItems.length, limitReached: true };
      }
    }

    // Reset failed items to pending
    failedItems.forEach(item => {
      updateItem(item.id, { status: 'pending', progress: 0, error: undefined });
    });

    const results = await processQueue(failedItems, user.id, initialPhotosToday);
    
    if (results.limitReached) {
      onLimitReached?.();
    }
    
    setIsUploading(false);
    onComplete?.(results);

    return results;
  }, [items, onComplete, onPhotoUploaded, updateItem, skipLimitCheck, checkDailyLimit, onLimitReached]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setItems([]);
    setIsUploading(false);
  }, []);

  const stats = {
    total: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    converting: items.filter(i => i.status === 'converting').length,
    uploading: items.filter(i => i.status === 'uploading').length,
    success: items.filter(i => i.status === 'success').length,
    failed: items.filter(i => i.status === 'error').length,
  };

  const currentIndex = stats.success + stats.failed + 1;

  return {
    items,
    isUploading,
    stats,
    currentIndex: Math.min(currentIndex, stats.total),
    bodyPart,
    setBodyPart,
    startUpload,
    retryFailed,
    cancel,
    reset,
  };
};
