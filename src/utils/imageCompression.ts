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
  full: {
    dataUrl: string;
    blob: Blob;
    fileName: string;
  };
  thumbnail: {
    dataUrl: string;
    blob: Blob;
    fileName: string;
  };
  format: {
    mimeType: string;
    extension: string;
  };
}

/**
 * Process an image for upload - generates both full-size and thumbnail versions
 * Full: max 1200px, 80% quality
 * Thumbnail: max 400px, 75% quality
 */
export const processImageForUpload = async (
  dataUrl: string,
  userId: string
): Promise<ProcessedImages> => {
  const format = getBestFormat();
  const baseFileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}`;
  
  // Generate full-size version (max 1200px)
  const fullDataUrl = await compressImage(dataUrl, 1200, 0.8, format.mimeType);
  const fullBlob = dataUrlToBlob(fullDataUrl, format.mimeType);
  
  // Generate thumbnail version (max 400px for grid view)
  const thumbDataUrl = await compressImage(dataUrl, 400, 0.75, format.mimeType);
  const thumbBlob = dataUrlToBlob(thumbDataUrl, format.mimeType);
  
  return {
    full: {
      dataUrl: fullDataUrl,
      blob: fullBlob,
      fileName: `${baseFileName}.${format.extension}`,
    },
    thumbnail: {
      dataUrl: thumbDataUrl,
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
 * Derive thumbnail URL from full photo URL
 * Uses naming convention: filename.ext -> filename_thumb.ext
 */
export const getThumbnailPath = (fullPath: string): string => {
  const lastDot = fullPath.lastIndexOf('.');
  if (lastDot === -1) return fullPath;
  return `${fullPath.substring(0, lastDot)}_thumb${fullPath.substring(lastDot)}`;
};
