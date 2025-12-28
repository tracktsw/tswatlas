/**
 * Parse timestamps that represent LOCAL device time (no timezone info).
 *
 * Why: iOS/Safari can interpret strings like "2025-02-04T17:00:00" as UTC,
 * causing ±1 day shifts when formatting dates.
 *
 * Supports:
 * - "YYYY-MM-DDTHH:mm:ss" (optional .SSS)
 * - "YYYY-MM-DD HH:mm:ss" (optional .SSS)
 * - If timezone is present (Z / +hh:mm / -hh:mm), falls back to native Date parsing.
 */
export function parseLocalDateTime(input: string | null | undefined): Date | null {
  if (!input) return null;
  const str = String(input).trim();
  if (!str) return null;

  // If it already has an explicit timezone, native parsing is safe.
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  // Accept either "T" or space separator.
  const normalized = str.replace(' ', 'T');

  // YYYY-MM-DDTHH:mm:ss(.SSS)?
  const m = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/
  );
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6]);
  const ms = m[7] ? Number(m[7].padEnd(3, '0')) : 0;

  if (y < 1990 || y > 2100) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  if (h < 0 || h > 23) return null;
  if (mi < 0 || mi > 59) return null;
  if (s < 0 || s > 59) return null;

  const date = new Date(y, mo - 1, d, h, mi, s, ms);
  if (isNaN(date.getTime())) return null;

  // Ensure no rollover (e.g. Feb 30)
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }

  return date;
}
