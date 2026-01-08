import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { processImageForUpload, getPublicUrl } from '@/utils/imageCompression';
import { BodyPart } from '@/contexts/UserDataContext';
import { prepareFileForUpload } from '@/utils/heicConverter';
import { extractExifDate } from '@/utils/exifExtractor';
import { startOfDay, endOfDay } from 'date-fns';

const FREE_DAILY_PHOTO_LIMIT = 2;

interface UploadOptions {
  bodyPart: BodyPart;
  notes?: string;
  /** Override EXIF date with user-provided date */
  takenAtOverride?: string | null;
  /** Skip the daily limit check (for premium users) */
  skipLimitCheck?: boolean;
}

interface UseSingleUploadOptions {
  onSuccess?: (photoId: string) => void;
  onError?: (error: string) => void;
  /** Called when daily limit is reached */
  onLimitReached?: () => void;
}

/**
 * Shared upload pipeline for single photo uploads.
 * Handles HEIC conversion, thumbnail/medium/original generation, and database insert.
 */
export const useSingleUpload = (options: UseSingleUploadOptions = {}) => {
  const { onSuccess, onError, onLimitReached } = options;
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Server-side check for daily upload limit
  const checkDailyLimit = useCallback(async (userId: string): Promise<boolean> => {
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
      console.error('[SingleUpload] Error checking daily limit:', error);
      return true; // Allow upload on error (fail open)
    }

    const photosToday = count || 0;
    if (import.meta.env.DEV) {
      console.log('[SingleUpload] Daily limit check:', photosToday, '/', FREE_DAILY_PHOTO_LIMIT);
    }

    return photosToday < FREE_DAILY_PHOTO_LIMIT;
  }, []);

  const processAndUploadFile = useCallback(async (
    file: File,
    uploadOptions: UploadOptions
  ): Promise<string | null> => {
    const { bodyPart, notes, takenAtOverride, skipLimitCheck } = uploadOptions;

    // Always log upload attempts for debugging Android issues
    console.log('[SingleUpload] Starting upload:', file.name, 'type:', file.type, 'size:', file.size);

    setIsUploading(true);
    setProgress(5);

    let uploadedPaths: string[] = [];

    try {
      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Server-side limit check (unless skipped for premium users)
      if (!skipLimitCheck) {
        const canUpload = await checkDailyLimit(user.id);
        if (!canUpload) {
          setIsUploading(false);
          setProgress(0);
          onLimitReached?.();
          return null;
        }
      }

      // Extract EXIF date from ORIGINAL file BEFORE any conversion
      // (HEIC conversion strips metadata, so we must do this first)
      // User can override this with takenAtOverride
      let takenAt: string | null = null;
      
      if (takenAtOverride !== undefined) {
        // User explicitly set a date (null means "use upload date")
        takenAt = takenAtOverride;
        if (import.meta.env.DEV) {
          console.log('[SingleUpload] Using override date:', takenAt || 'none (will use upload date)');
        }
      } else {
        // Auto-extract from EXIF - returns timezone-less "YYYY-MM-DDTHH:MM:SS"
        if (import.meta.env.DEV) {
          console.log('[SingleUpload] Extracting EXIF date from original file...');
        }
        takenAt = await extractExifDate(file);
        if (import.meta.env.DEV) {
          console.log('[SingleUpload] EXIF date extracted:', takenAt || 'not found');
          if (!takenAt) {
            console.log('[SingleUpload] Will fall back to upload date (created_at) for display');
          }
        }
      }

      // Convert HEIC to JPEG if needed, returns data URL
      console.log('[SingleUpload] Converting file to data URL (HEIC if needed)...');
      setProgress(15);
      
      let dataUrl: string;
      try {
        dataUrl = await prepareFileForUpload(file);
        console.log('[SingleUpload] File conversion successful, data URL length:', dataUrl.length);
      } catch (conversionError) {
        const msg = conversionError instanceof Error ? conversionError.message : 'File conversion failed';
        console.error('[SingleUpload] File conversion failed:', msg);
        throw new Error(`Could not process image: ${msg}`);
      }
      
      setProgress(25);

      // Process image (generate thumb, medium, original)
      const processed = await processImageForUpload(dataUrl, user.id);
      setProgress(50);

      if (import.meta.env.DEV) {
        console.log('[SingleUpload] Uploading to storage...');
      }

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

      setProgress(75);

      // Track uploads for cleanup
      if (!thumbResult.error) uploadedPaths.push(processed.thumbnail.path);
      if (!mediumResult.error) uploadedPaths.push(processed.medium.path);
      if (!originalResult.error) uploadedPaths.push(processed.original.path);

      if (thumbResult.error) {
        throw new Error(thumbResult.error.message || 'Thumbnail upload failed');
      }
      if (mediumResult.error) {
        throw new Error(mediumResult.error.message || 'Image upload failed');
      }

      // Generate public URLs
      const thumbUrl = getPublicUrl(processed.thumbnail.path);
      const mediumUrl = getPublicUrl(processed.medium.path);
      const originalUrl = !originalResult.error ? getPublicUrl(processed.original.path) : null;

      if (import.meta.env.DEV) {
        console.log('[SingleUpload] Saving to database...');
      }

      // Insert database record
      // - taken_at = EXIF date or user override (when photo was actually taken)
      // - created_at = auto-set by database (when uploaded)
      const { data: insertedPhoto, error: insertError } = await supabase
        .from('user_photos')
        .insert({
          user_id: user.id,
          body_part: bodyPart,
          photo_url: mediumUrl,
          thumb_url: thumbUrl,
          medium_url: mediumUrl,
          original_url: originalUrl,
          notes: notes || null,
          taken_at: takenAt,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message || 'Database error');
      }

      setProgress(100);
      setIsUploading(false);

      if (import.meta.env.DEV) {
        const dateSource = takenAtOverride !== undefined ? 'override' : (takenAt ? 'exif' : 'upload_fallback');
        console.log('[SingleUpload] Upload complete:', {
          photo_id: insertedPhoto.id,
          taken_at: takenAt,
          date_source: dateSource,
          exif_present: takenAtOverride === undefined && !!takenAt,
          had_override: takenAtOverride !== undefined,
        });
      }

      onSuccess?.(insertedPhoto.id);
      return insertedPhoto.id;

    } catch (error) {
      // Cleanup uploaded files on error
      if (uploadedPaths.length > 0) {
        try {
          await supabase.storage.from('photos').remove(uploadedPaths);
        } catch {}
      }

      const message = error instanceof Error ? error.message : 'Upload failed';
      if (import.meta.env.DEV) {
        console.error('[SingleUpload] Upload failed:', message);
      }

      setIsUploading(false);
      setProgress(0);
      onError?.(message);
      return null;
    }
  }, [onSuccess, onError, onLimitReached, checkDailyLimit]);

  const reset = useCallback(() => {
    setIsUploading(false);
    setProgress(0);
  }, []);

  return {
    processAndUploadFile,
    isUploading,
    progress,
    reset,
  };
};
