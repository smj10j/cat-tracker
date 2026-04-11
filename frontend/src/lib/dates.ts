/**
 * Parse a date-only string (YYYY-MM-DD) as a local-timezone date.
 *
 * JavaScript's `new Date('2021-10-01')` interprets date-only strings as UTC midnight,
 * which shows as the previous day in western timezones. Appending T12:00:00 ensures
 * the date lands on the correct calendar day in any timezone from UTC-12 to UTC+14.
 *
 * Strings that already include a time component (T or space separator) are parsed as-is.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  // If it's already a datetime (has T or space+time), parse as-is
  if (dateStr.includes('T') || dateStr.length > 10) return new Date(dateStr);
  // Date-only: anchor to noon to avoid timezone day-shift
  return new Date(dateStr + 'T12:00:00');
}

/**
 * Format a date-only string for display (e.g., "October 1, 2021").
 */
export function formatLocalDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  const d = parseLocalDate(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, options ?? { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Calculate age from a birthdate string.
 */
export function catAge(birthdate: string): string {
  const birth = parseLocalDate(birthdate);
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} old`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}y ${rem}mo` : `${years} year${years !== 1 ? 's' : ''} old`;
}
