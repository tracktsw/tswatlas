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
 * Compress and resize an image to specified dimensions
 */
export const compressImage = (
  dataUrl: string,
  maxDimension: number = 1200,
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

      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
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
  original: {
    blob: Blob;
    fileName: string;
  };
  medium: {
    blob: Blob;
    fileName: string;
  };
  thumbnail: {
    blob: Blob;
    fileName: string;
  };
  format: {
    mimeType: string;
    extension: string;
  };
}

/**
 * Process an image for upload - generates three versions:
 * - Original: full quality for export/backup
 * - Medium: max 1200px, 85% quality for fullscreen/compare
 * - Thumbnail: max 400px, 75% quality for grid views
 */
export const processImageForUpload = async (
  dataUrl: string,
  userId: string
): Promise<ProcessedImages> => {
  const format = getBestFormat();
  const baseFileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}`;
  
  // Generate medium version (max 1200px) for fullscreen/compare
  const mediumDataUrl = await compressImage(dataUrl, 1200, 0.85, format.mimeType);
  const mediumBlob = dataUrlToBlob(mediumDataUrl, format.mimeType);
  
  // Generate thumbnail version (max 400px for grid view)
  const thumbDataUrl = await compressImage(dataUrl, 400, 0.75, format.mimeType);
  const thumbBlob = dataUrlToBlob(thumbDataUrl, format.mimeType);
  
  // Store original in JPEG for maximum compatibility (backup/export)
  const originalBlob = dataUrlToBlob(dataUrl, 'image/jpeg');
  
  return {
    original: {
      blob: originalBlob,
      fileName: `${baseFileName}_original.jpg`,
    },
    medium: {
      blob: mediumBlob,
      fileName: `${baseFileName}.${format.extension}`,
    },
    thumbnail: {
      blob: thumbBlob,
      fileName: `${baseFileName}_thumb.${format.extension}`,
    },
    format,
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
 * Derive thumbnail path from medium photo path
 * Uses naming convention: filename.ext -> filename_thumb.ext
 */
export const getThumbnailPath = (mediumPath: string): string => {
  const lastDot = mediumPath.lastIndexOf('.');
  if (lastDot === -1) return mediumPath;
  return `${mediumPath.substring(0, lastDot)}_thumb${mediumPath.substring(lastDot)}`;
};

/**
 * Derive original path from medium photo path
 * Uses naming convention: filename.ext -> filename_original.jpg
 */
export const getOriginalPath = (mediumPath: string): string => {
  const lastDot = mediumPath.lastIndexOf('.');
  if (lastDot === -1) return mediumPath;
  return `${mediumPath.substring(0, lastDot)}_original.jpg`;
};
