import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { processImageForUpload, getPublicUrl } from '@/utils/imageCompression';
import { BodyPart } from '@/contexts/UserDataContext';

export interface UploadItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  photoId?: string;
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

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const uploadSinglePhoto = async (item: UploadItem, userId: string): Promise<boolean> => {
    if (cancelledRef.current) return false;

    updateItem(item.id, { status: 'uploading', progress: 10 });
    let uploadedPaths: string[] = [];

    try {
      // Convert file to data URL
      const dataUrl = await fileToDataUrl(item.file);
      updateItem(item.id, { progress: 20 });

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

      if (thumbResult.error) throw new Error(`Thumbnail upload failed`);
      if (mediumResult.error) throw new Error(`Image upload failed`);

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
        })
        .select()
        .single();

      if (insertError) throw new Error(`Database error`);

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
      updateItem(item.id, { status: 'error', progress: 0, error: message });
      return false;
    }
  };

  const processQueue = async (queue: UploadItem[], userId: string) => {
    let successCount = 0;
    let failedCount = 0;
    let currentIndex = 0;

    const runNext = async (): Promise<void> => {
      if (cancelledRef.current || currentIndex >= queue.length) return;

      const item = queue[currentIndex++];
      if (item.status === 'success') {
        successCount++;
        return runNext();
      }

      activeUploadsRef.current++;
      const success = await uploadSinglePhoto(item, userId);
      activeUploadsRef.current--;

      if (success) successCount++;
      else failedCount++;

      return runNext();
    };

    // Start concurrent uploads
    const workers = Array(Math.min(concurrency, queue.length))
      .fill(null)
      .map(() => runNext());

    await Promise.all(workers);

    return { success: successCount, failed: failedCount };
  };

  const startUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    cancelledRef.current = false;
    setIsUploading(true);

    // Create upload items
    const newItems: UploadItem[] = files.map((file, index) => ({
      id: `upload-${Date.now()}-${index}`,
      file,
      status: 'pending' as const,
      progress: 0,
    }));

    setItems(newItems);

    // Process queue
    const results = await processQueue(newItems, user.id);
    
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
