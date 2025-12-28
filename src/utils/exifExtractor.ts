/**
 * EXIF date extraction utility
 * Extracts DateTimeOriginal or CreateDate from image metadata
 * Works with JPEG, HEIC/HEIF, PNG, TIFF, and other image formats
 *
 * Uses `exifr` - a modern, fast EXIF parser that reads directly from File objects.
 *
 * IMPORTANT: EXIF dates are LOCAL device time (no timezone info).
 * We return timezone-less strings to avoid off-by-one-day errors.
 */

import exifr from 'exifr';

export type ExifSource = 'exif' | 'user' | 'missing';

export interface ExifResult {
  /** Timezone-less ISO string "YYYY-MM-DDTHH:MM:SS" or null */
  date: string | null;
  /** Where the date came from */
  source: ExifSource;
  /** Raw EXIF value for debugging */
  rawValue?: string | Date;
}

/**
 * Extract EXIF date from an image file.
 * Returns { date, source } so callers know provenance.
 *
 * IMPORTANT: Call with the ORIGINAL file BEFORE any conversion (HEIC→JPEG strips metadata).
 */
export const extractExifDate = async (file: File): Promise<string | null> => {
  const result = await extractExifDateWithSource(file);
  return result.date;
};

/**
 * Extended version that also returns the source of the date.
 */
export const extractExifDateWithSource = async (file: File): Promise<ExifResult> => {
  try {
    if (import.meta.env.DEV) {
      console.log('[EXIF] Extracting from file:', file.name, 'type:', file.type, 'size:', file.size);
    }

    // exifr.parse reads directly from File/Blob - no Image element needed
    // This works for JPEG, HEIC, TIFF, PNG, WebP, AVIF
    const exif = await exifr.parse(file, {
      // Only extract date-related tags for speed
      pick: ['DateTimeOriginal', 'CreateDate', 'DateTimeDigitized', 'ModifyDate', 'DateTime'],
      // Skip thumbnail parsing for speed
      translateValues: true,
      reviveValues: true,
    });

    if (import.meta.env.DEV) {
      console.log('[EXIF] Raw exifr result:', exif);
    }

    if (!exif) {
      if (import.meta.env.DEV) {
        console.log('[EXIF] No EXIF data found in file');
      }
      return { date: null, source: 'missing' };
    }

    // Priority order per requirements:
    // 1. DateTimeOriginal - when photo was actually taken (best)
    // 2. CreateDate / DateTimeDigitized - when image was digitized
    // 3. ModifyDate / DateTime - last resort
    const candidates = [
      exif.DateTimeOriginal,
      exif.CreateDate,
      exif.DateTimeDigitized,
      exif.ModifyDate,
      exif.DateTime,
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;

      const parsed = parseExifValue(candidate);
      if (parsed) {
        if (import.meta.env.DEV) {
          console.log('[EXIF] Extracted date:', parsed, 'from raw:', candidate);
        }
        return { date: parsed, source: 'exif', rawValue: candidate };
      }
    }

    if (import.meta.env.DEV) {
      console.log('[EXIF] EXIF data present but no valid date tags found');
    }
    return { date: null, source: 'missing' };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[EXIF] Error extracting date:', error);
    }
    return { date: null, source: 'missing' };
  }
};

/**
 * Parse an EXIF date value (can be Date object or string) to timezone-less ISO string.
 */
function parseExifValue(value: unknown): string | null {
  if (!value) return null;

  // exifr can return Date objects when reviveValues is true
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    // Validate date range
    if (!isValidPhotoDate(value)) return null;
    return formatLocalDate(value);
  }

  // String format: "YYYY:MM:DD HH:MM:SS" or "YYYY-MM-DD HH:MM:SS"
  if (typeof value === 'string') {
    return parseExifDateString(value);
  }

  return null;
}

/**
 * Parse EXIF date string format to timezone-less ISO string.
 * Handles both "YYYY:MM:DD HH:MM:SS" and "YYYY-MM-DD HH:MM:SS" formats.
 */
function parseExifDateString(exifDate: string): string | null {
  try {
    // Normalize separators
    const normalized = exifDate.replace(/:/g, '-').replace(' ', 'T');

    // Match "YYYY-MM-DDTHH-MM-SS" pattern
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
    if (!match) {
      // Try alternate format
      const altMatch = exifDate.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
      if (!altMatch) return null;

      const [, year, month, day, hour, minute, second] = altMatch;
      return validateAndFormat(
        parseInt(year, 10),
        parseInt(month, 10),
        parseInt(day, 10),
        parseInt(hour, 10),
        parseInt(minute, 10),
        parseInt(second, 10)
      );
    }

    const [, year, month, day, hour, minute, second] = match;
    return validateAndFormat(
      parseInt(year, 10),
      parseInt(month, 10),
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      parseInt(second, 10)
    );
  } catch {
    return null;
  }
}

/**
 * Validate date components and format as timezone-less ISO string.
 */
function validateAndFormat(
  y: number,
  m: number,
  d: number,
  h: number,
  min: number,
  s: number
): string | null {
  // Basic sanity checks
  if (y < 1990 || y > new Date().getFullYear() + 1) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59 || s < 0 || s > 59) return null;

  // Construct local Date to validate (e.g. Feb 30 → invalid)
  const testDate = new Date(y, m - 1, d, h, min, s);
  if (isNaN(testDate.getTime())) return null;

  // Check day didn't roll over (e.g. Feb 30 → Mar 2)
  if (testDate.getDate() !== d) return null;

  // Validate date range
  if (!isValidPhotoDate(testDate)) return null;

  return formatLocalDate(testDate);
}

/**
 * Check if a date is valid for a photo (not in future, not too old).
 */
function isValidPhotoDate(date: Date): boolean {
  const now = new Date();
  // Allow 1 day in future for timezone edge cases
  const maxDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  // Don't accept dates before 1990
  const minDate = new Date(1990, 0, 1);

  return date >= minDate && date <= maxDate;
}

/**
 * Format a Date as timezone-less ISO string "YYYY-MM-DDTHH:MM:SS".
 * Uses local time components to avoid timezone shifts.
 */
function formatLocalDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Format a Date object to an ISO-like string for database storage,
 * preserving local date/time to avoid timezone shifts.
 * Format: "YYYY-MM-DDTHH:MM:SS" (no timezone suffix, treated as local)
 */
export const formatLocalDateForDb = (date: Date): string => {
  return formatLocalDate(date);
};
