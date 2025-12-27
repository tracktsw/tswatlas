import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { processImageForUpload, getPublicUrl } from '@/utils/imageCompression';
import { BodyPart } from '@/contexts/UserDataContext';
import { isHeicFile, prepareFileForUpload } from '@/utils/heicConverter';
import { extractExifDate } from '@/utils/exifExtractor';

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
  onComplete?: (results: { success: number; failed: number }) => void;
}

export const useBatchUpload = (options: UseBatchUploadOptions = {}) => {
  const { concurrency = 2, onPhotoUploaded, onComplete } = options;
  
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [bodyPart, setBodyPart] = useState<BodyPart>('face');
  const cancelledRef = useRef(false);
  const activeUploadsRef = useRef(0);

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
      // Convert HEIC if needed
      if (item.isHeic) {
        updateItem(item.id, { status: 'converting', progress: 5 });
        if (import.meta.env.DEV) {
          console.log('[BatchUpload] Converting HEIC:', item.file.name);
        }
      }

      // Prepare file (converts HEIC if needed, returns data URL)
      const dataUrl = await prepareFileForUpload(item.file);
      
      // Extract EXIF date before processing
      const exifDate = await extractExifDate(dataUrl);
      if (import.meta.env.DEV) {
        console.log('[BatchUpload] EXIF date for', item.file.name + ':', exifDate || 'not found');
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

      // Insert database record (use EXIF date if available)
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
          ...(exifDate && { created_at: exifDate }),
        })
        .select()
        .single();

      if (insertError) {
        const errMsg = insertError.message || 'Database error';
        if (import.meta.env.DEV) console.error('[BatchUpload] DB error:', errMsg);
        throw new Error(errMsg);
      }

      if (import.meta.env.DEV) {
        console.log('[BatchUpload] Upload success:', item.file.name, '-> photoId:', insertedPhoto.id);
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
  const processQueue = async (queue: UploadItem[], userId: string) => {
    let successCount = 0;
    let failedCount = 0;

    for (const item of queue) {
      if (cancelledRef.current) break;

      if (item.status === 'success') {
        successCount++;
        continue;
      }

      // Process one at a time - iOS is more reliable this way
      const success = await uploadSinglePhoto(item, userId);

      if (success) {
        successCount++;
      } else {
        failedCount++;
      }
    }

    return { success: successCount, failed: failedCount };
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
    setIsUploading(true);

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
    const results = await processQueue(newItems, user.id);
    
    if (import.meta.env.DEV) {
      console.log('[BatchUpload] Upload complete. Success:', results.success, 'Failed:', results.failed);
    }
    
    setIsUploading(false);
    onComplete?.(results);

    return results;
  }, [bodyPart, concurrency, onComplete, onPhotoUploaded]);

  const retryFailed = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const failedItems = items.filter(item => item.status === 'error');
    if (failedItems.length === 0) return;

    cancelledRef.current = false;
    setIsUploading(true);

    // Reset failed items to pending
    failedItems.forEach(item => {
      updateItem(item.id, { status: 'pending', progress: 0, error: undefined });
    });

    const results = await processQueue(failedItems, user.id);
    setIsUploading(false);
    onComplete?.(results);

    return results;
  }, [items, onComplete, onPhotoUploaded, updateItem]);

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
