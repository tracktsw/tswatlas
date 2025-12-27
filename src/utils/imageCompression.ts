/**
 * Check if browser supports WebP encoding
 */
const supportsWebP = (): boolean => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
};

/**
 * Get the best supported image format
 */
export const getBestFormat = (): { mimeType: string; extension: string } => {
  if (supportsWebP()) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  return { mimeType: 'image/jpeg', extension: 'jpg' };
};

/**
 * Compress and resize an image to specified width (maintaining aspect ratio)
 */
export const compressImage = (
  dataUrl: string,
  maxWidth: number = 1400,
  quality: number = 0.8,
  format?: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Calculate new dimensions maintaining aspect ratio based on width
      let { width, height } = img;
      
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // Use better image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      const mimeType = format || getBestFormat().mimeType;
      const compressedDataUrl = canvas.toDataURL(mimeType, quality);
      resolve(compressedDataUrl);
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
};

export interface ProcessedImages {
  photoId: string;
  original: {
    blob: Blob;
    path: string;
  };
  medium: {
    blob: Blob;
    path: string;
  };
  thumbnail: {
    blob: Blob;
    path: string;
  };
}

/**
 * Generate a UUID for photo identification
 */
export const generatePhotoId = (): string => {
  return crypto.randomUUID();
};

/**
 * Process an image for upload - generates three versions:
 * - Thumbnail: 400px width, WebP, ~70-80% quality for grid views
 * - Medium: 1400px width, WebP, ~75-85% quality for fullscreen/compare
 * - Original: unchanged JPEG for backup/export
 * 
 * Storage paths: photos/{photoId}/thumb.webp, medium.webp, original.jpg
 */
export const processImageForUpload = async (
  dataUrl: string
): Promise<ProcessedImages> => {
  const photoId = generatePhotoId();
  
  // Generate thumbnail version (400px width) for grid view
  const thumbDataUrl = await compressImage(dataUrl, 400, 0.75, 'image/webp');
  const thumbBlob = dataUrlToBlob(thumbDataUrl, 'image/webp');
  
  // Generate medium version (1400px width) for fullscreen/compare
  const mediumDataUrl = await compressImage(dataUrl, 1400, 0.80, 'image/webp');
  const mediumBlob = dataUrlToBlob(mediumDataUrl, 'image/webp');
  
  // Store original in JPEG for maximum compatibility (backup/export)
  const originalBlob = dataUrlToBlob(dataUrl, 'image/jpeg');
  
  return {
    photoId,
    original: {
      blob: originalBlob,
      path: `photos/${photoId}/original.jpg`,
    },
    medium: {
      blob: mediumBlob,
      path: `photos/${photoId}/medium.webp`,
    },
    thumbnail: {
      blob: thumbBlob,
      path: `photos/${photoId}/thumb.webp`,
    },
  };
};

/**
 * Convert a data URL to a Blob
 */
export const dataUrlToBlob = (dataUrl: string, mimeType: string): Blob => {
  const base64Data = dataUrl.split(',')[1];
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

/**
 * Get public URL for a file in the photos bucket
 */
export const getPublicUrl = (path: string): string => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/photos/${path}`;
};
