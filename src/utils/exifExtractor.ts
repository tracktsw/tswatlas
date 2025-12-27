/**
 * EXIF date extraction utility
 * Extracts DateTimeOriginal or DateTimeDigitized from image metadata
 * Works with JPEG, HEIC, and other image formats
 */

import EXIF from 'exif-js';

/**
 * Extract EXIF date from an image file.
 * Returns the date as ISO string or null if not found.
 * IMPORTANT: Call this with the ORIGINAL file BEFORE any conversion (HEIC->JPEG strips metadata)
 */
export const extractExifDate = async (input: File | string): Promise<string | null> => {
  try {
    // If input is a File, use exif-js directly (works with HEIC)
    if (input instanceof File) {
      return await extractExifFromFile(input);
    }
    
    // If input is a data URL, fall back to manual parsing (for JPEG only)
    return await extractExifFromDataUrl(input);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[EXIF] Error extracting date:', error);
    }
    return null;
  }
};

/**
 * Extract EXIF date using exif-js library (works with HEIC files)
 */
const extractExifFromFile = (file: File): Promise<string | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      const img = new Image();
      
      img.onload = function() {
        try {
          // @ts-ignore - exif-js types are incomplete
          EXIF.getData(img, function(this: any) {
            // Try DateTimeOriginal first (when photo was actually taken)
            let dateStr = EXIF.getTag(this, 'DateTimeOriginal');
            
            // Fall back to DateTimeDigitized
            if (!dateStr) {
              dateStr = EXIF.getTag(this, 'DateTimeDigitized');
            }
            
            // Fall back to DateTime
            if (!dateStr) {
              dateStr = EXIF.getTag(this, 'DateTime');
            }
            
            if (dateStr && typeof dateStr === 'string') {
              const isoDate = parseExifDateTime(dateStr);
              if (import.meta.env.DEV) {
                console.log('[EXIF] Extracted date from file:', isoDate);
              }
              resolve(isoDate);
            } else {
              if (import.meta.env.DEV) {
                console.log('[EXIF] No date found in file metadata');
              }
              resolve(null);
            }
          });
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn('[EXIF] exif-js error:', err);
          }
          resolve(null);
        }
      };
      
      img.onerror = () => {
        if (import.meta.env.DEV) {
          console.warn('[EXIF] Failed to load image for EXIF extraction');
        }
        resolve(null);
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      resolve(null);
    };
    
    reader.readAsDataURL(file);
  });
};

/**
 * Extract EXIF date from a JPEG data URL by parsing the binary data
 * (Fallback for when we only have a data URL)
 */
const extractExifFromDataUrl = async (dataUrl: string): Promise<string | null> => {
  try {
    // Convert data URL to array buffer
    const base64 = dataUrl.split(',')[1];
    if (!base64) return null;

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Check for JPEG magic bytes
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
      // Not a JPEG, can't extract EXIF this way
      return null;
    }

    // Find EXIF marker (APP1)
    let offset = 2;
    while (offset < bytes.length - 4) {
      if (bytes[offset] !== 0xFF) {
        offset++;
        continue;
      }

      const marker = bytes[offset + 1];
      
      // APP1 marker (EXIF)
      if (marker === 0xE1) {
        const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
        const exifData = bytes.slice(offset + 4, offset + 2 + length);
        
        // Check for "Exif\0\0" header
        const exifHeader = String.fromCharCode(...exifData.slice(0, 4));
        if (exifHeader === 'Exif') {
          return parseExifTiffData(exifData.slice(6));
        }
      }

      // Skip to next marker
      if (marker >= 0xE0 && marker <= 0xEF) {
        const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
        offset += 2 + length;
      } else if (marker === 0xD8 || marker === 0xD9) {
        offset += 2;
      } else {
        offset++;
      }
    }

    return null;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[EXIF] Parse error:', error);
    }
    return null;
  }
};

/**
 * Parse EXIF TIFF data to find DateTimeOriginal or DateTime
 */
const parseExifTiffData = (data: Uint8Array): string | null => {
  try {
    // Check byte order (II = little-endian, MM = big-endian)
    const byteOrder = String.fromCharCode(data[0], data[1]);
    const isLittleEndian = byteOrder === 'II';

    const readUint16 = (offset: number): number => {
      if (isLittleEndian) {
        return data[offset] | (data[offset + 1] << 8);
      }
      return (data[offset] << 8) | data[offset + 1];
    };

    const readUint32 = (offset: number): number => {
      if (isLittleEndian) {
        return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
      }
      return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
    };

    // Verify TIFF header
    const tiffCheck = readUint16(2);
    if (tiffCheck !== 0x002A) return null;

    // Get IFD0 offset
    let ifdOffset = readUint32(4);

    // Search for EXIF IFD pointer (tag 0x8769) in IFD0
    let exifIfdOffset: number | null = null;
    let dateTime: string | null = null;

    // Parse IFD0
    const numEntries = readUint16(ifdOffset);
    for (let i = 0; i < numEntries; i++) {
      const entryOffset = ifdOffset + 2 + (i * 12);
      const tag = readUint16(entryOffset);
      
      // DateTime tag (0x0132)
      if (tag === 0x0132) {
        const valueOffset = readUint32(entryOffset + 8);
        dateTime = readString(data, valueOffset, 19);
      }
      
      // EXIF IFD pointer (0x8769)
      if (tag === 0x8769) {
        exifIfdOffset = readUint32(entryOffset + 8);
      }
    }

    // Parse EXIF IFD for DateTimeOriginal
    if (exifIfdOffset !== null) {
      const exifNumEntries = readUint16(exifIfdOffset);
      for (let i = 0; i < exifNumEntries; i++) {
        const entryOffset = exifIfdOffset + 2 + (i * 12);
        const tag = readUint16(entryOffset);
        
        // DateTimeOriginal (0x9003) - preferred
        if (tag === 0x9003) {
          const valueOffset = readUint32(entryOffset + 8);
          const dateTimeOriginal = readString(data, valueOffset, 19);
          if (dateTimeOriginal) {
            return parseExifDateTime(dateTimeOriginal);
          }
        }
        
        // DateTimeDigitized (0x9004) - fallback
        if (tag === 0x9004 && !dateTime) {
          const valueOffset = readUint32(entryOffset + 8);
          dateTime = readString(data, valueOffset, 19);
        }
      }
    }

    // Use DateTime from IFD0 as last fallback
    if (dateTime) {
      return parseExifDateTime(dateTime);
    }

    return null;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[EXIF] TIFF parse error:', error);
    }
    return null;
  }
};

/**
 * Read a string from EXIF data
 */
const readString = (data: Uint8Array, offset: number, maxLength: number): string | null => {
  try {
    let str = '';
    for (let i = 0; i < maxLength && offset + i < data.length; i++) {
      const char = data[offset + i];
      if (char === 0) break;
      str += String.fromCharCode(char);
    }
    return str.length > 0 ? str : null;
  } catch {
    return null;
  }
};

/**
 * Parse EXIF date format "YYYY:MM:DD HH:MM:SS" to ISO string
 */
const parseExifDateTime = (exifDate: string): string | null => {
  try {
    // EXIF format: "YYYY:MM:DD HH:MM:SS"
    const match = exifDate.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return null;

    const [, year, month, day, hour, minute, second] = match;
    const date = new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      parseInt(second, 10)
    );

    // Validate date
    if (isNaN(date.getTime())) return null;
    
    // Don't accept dates before 1990 or in the future
    const now = new Date();
    if (date.getFullYear() < 1990 || date > now) return null;

    return date.toISOString();
  } catch {
    return null;
  }
};
