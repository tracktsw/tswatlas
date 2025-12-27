import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { processImageForUpload, getPublicUrl } from '@/utils/imageCompression';
import { BodyPart } from '@/contexts/UserDataContext';
import { prepareFileForUpload } from '@/utils/heicConverter';

interface UploadOptions {
  bodyPart: BodyPart;
  notes?: string;
}

interface UseSingleUploadOptions {
  onSuccess?: (photoId: string) => void;
  onError?: (error: string) => void;
}

/**
 * Shared upload pipeline for single photo uploads.
 * Handles HEIC conversion, thumbnail/medium/original generation, and database insert.
 */
export const useSingleUpload = (options: UseSingleUploadOptions = {}) => {
  const { onSuccess, onError } = options;
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const processAndUploadFile = useCallback(async (
    file: File,
    uploadOptions: UploadOptions
  ): Promise<string | null> => {
    const { bodyPart, notes } = uploadOptions;

    if (import.meta.env.DEV) {
      console.log('[SingleUpload] Starting upload:', file.name, 'type:', file.type, 'size:', file.size);
    }

    setIsUploading(true);
    setProgress(5);

    let uploadedPaths: string[] = [];

    try {
      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Convert HEIC to JPEG if needed, returns data URL
      if (import.meta.env.DEV) {
        console.log('[SingleUpload] Converting file to data URL (HEIC if needed)...');
      }
      setProgress(10);
      const dataUrl = await prepareFileForUpload(file);
      
      if (import.meta.env.DEV) {
        console.log('[SingleUpload] File converted, processing image...');
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
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message || 'Database error');
      }

      setProgress(100);
      setIsUploading(false);

      if (import.meta.env.DEV) {
        console.log('[SingleUpload] Upload success! photoId:', insertedPhoto.id);
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
  }, [onSuccess, onError]);

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
