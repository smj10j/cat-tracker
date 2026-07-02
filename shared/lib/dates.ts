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
 * Convert a local date + time in a given IANA timezone to a UTC datetime string.
 * Handles DST transitions correctly — each date gets the right UTC offset.
 *
 * @param date - 'YYYY-MM-DD'
 * @param time - 'HH:MM'
 * @param timezone - IANA timezone string, e.g. 'America/New_York'
 * @returns 'YYYY-MM-DD HH:MM:00' in UTC
 */
export function localToUTC(date: string, time: string, timezone: string): string {
  // Treat the input as UTC provisionally, then compute the offset to the target timezone
  const provisional = new Date(`${date}T${time}:00Z`);
  const utcStr = provisional.toLocaleString('en-US', { timeZone: 'UTC' });
  const localStr = provisional.toLocaleString('en-US', { timeZone: timezone });
  const utcMs = new Date(utcStr).getTime();
  const localMs = new Date(localStr).getTime();
  const offsetMs = utcMs - localMs;
  const result = new Date(provisional.getTime() + offsetMs);
  return result.toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Convert a UTC datetime string to local date and time components.
 * Used client-side for display. Falls back to device timezone if none specified.
 *
 * Assumes the input IS UTC. Dose rows created before a user's timezone was
 * captured are stored as naive local time and will display offset by the UTC
 * delta — this self-heals: both clients sync the device timezone on every
 * sign-in (AuthContext → PUT /auth/me), which lazily regenerates future doses
 * in UTC.
 *
 * @param utcDatetime - 'YYYY-MM-DD HH:MM:00' or 'YYYY-MM-DD HH:MM:SS' (UTC, no Z suffix)
 * @param timezone - IANA timezone string (defaults to device timezone)
 * @returns { date: 'YYYY-MM-DD', time: 'HH:MM' } in local time
 */
export function utcToLocal(
  utcDatetime: string,
  timezone?: string,
): { date: string; time: string } {
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const d = new Date(utcDatetime.replace(' ', 'T') + 'Z');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

/**
 * Calculate age from a birthdate string.
 * Counts only completed months — the month ticks over on the birthdate's
 * day-of-month, not on the 1st of the month.
 */
export function catAge(birthdate: string): string {
  const birth = parseLocalDate(birthdate);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months--;
  if (months < 0) months = 0;
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} old`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}y ${rem}mo` : `${years} year${years !== 1 ? 's' : ''} old`;
}
