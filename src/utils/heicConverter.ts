import heic2any from 'heic2any';

/**
 * Check if a file is HEIC/HEIF format
 */
export const isHeicFile = (file: File): boolean => {
  // Check MIME type
  const mimeType = file.type.toLowerCase();
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    return true;
  }
  
  // iOS Safari sometimes has empty type, so check extension
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
    return true;
  }
  
  return false;
};

/**
 * Convert HEIC/HEIF file to JPEG Blob
 * Returns the original file if not HEIC or conversion fails
 */
export const convertHeicToJpeg = async (
  file: File,
  quality: number = 0.85
): Promise<Blob> => {
  if (!isHeicFile(file)) {
    return file;
  }

  if (import.meta.env.DEV) {
    console.log('[HEIC] Converting:', file.name, 'size:', file.size);
  }

  try {
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality,
    });

    // heic2any can return single blob or array
    const convertedBlob = Array.isArray(result) ? result[0] : result;
    
    if (import.meta.env.DEV) {
      console.log('[HEIC] Conversion success:', file.name, 'new size:', convertedBlob.size);
    }

    return convertedBlob;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (import.meta.env.DEV) {
      console.error('[HEIC] Conversion failed:', file.name, '-', message);
    }
    throw new Error(`HEIC conversion failed: ${message}`);
  }
};

/**
 * Process a file for upload - converts HEIC if needed, returns data URL
 */
export const prepareFileForUpload = async (file: File): Promise<string> => {
  // Convert HEIC to JPEG if needed
  const processedBlob = await convertHeicToJpeg(file);
  
  // Convert blob to data URL
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(processedBlob);
  });
};
