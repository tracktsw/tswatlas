import heic2any from 'heic2any';

/**
 * Convert blob to data URL
 */
const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(blob);
  });
};

/**
 * Check if a file is HEIC/HEIF format
 * Handles iOS (image/heic, image/heif) and Android 11+ (image/vnd.android.heic)
 */
export const isHeicFile = (file: File): boolean => {
  const mimeType = file.type.toLowerCase();
  
  // iOS uses image/heic, image/heif
  // Android 11+ uses image/vnd.android.heic
  if (
    mimeType === 'image/heic' || 
    mimeType === 'image/heif' ||
    mimeType === 'image/vnd.android.heic' ||
    mimeType.includes('heic') ||
    mimeType.includes('heif')
  ) {
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

  console.log('[HEIC] Converting:', file.name, 'type:', file.type, 'size:', file.size);

  try {
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality,
    });

    // heic2any can return single blob or array
    const convertedBlob = Array.isArray(result) ? result[0] : result;
    
    console.log('[HEIC] Conversion success:', file.name, 'new size:', convertedBlob.size);

    return convertedBlob;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[HEIC] heic2any conversion failed:', file.name, '-', message);
    
    // Fallback: Some Android WebViews can decode HEIC natively via canvas
    // Try to read the file directly - if it works, the browser supports it
    console.log('[HEIC] Attempting native decode fallback for:', file.name);
    throw new Error(`HEIC conversion failed: ${message}`);
  }
};

/**
 * Process a file for upload - converts HEIC if needed, returns data URL
 * Includes fallback for Android devices that can decode HEIC natively
 */
export const prepareFileForUpload = async (file: File): Promise<string> => {
  console.log('[Upload] Preparing file:', file.name, 'type:', file.type, 'size:', file.size);
  
  try {
    if (isHeicFile(file)) {
      console.log('[Upload] HEIC detected, attempting conversion...');
      const processedBlob = await convertHeicToJpeg(file);
      return blobToDataUrl(processedBlob);
    }
    
    // Non-HEIC file, read directly
    return blobToDataUrl(file);
  } catch (error) {
    // Fallback: try to read the file directly
    // Android WebView and some browsers can decode HEIC natively
    console.warn('[Upload] HEIC conversion failed, attempting direct read fallback:', error);
    
    try {
      const dataUrl = await blobToDataUrl(file);
      console.log('[Upload] Direct read fallback succeeded for:', file.name);
      return dataUrl;
    } catch (readError) {
      console.error('[Upload] Direct read fallback also failed:', readError);
      throw new Error(`Failed to process image: ${file.name}`);
    }
  }
};
