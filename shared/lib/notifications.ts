/**
 * Pure notification-preference helpers (PRD-actionable-notifications Phase B/C).
 *
 * Timezone-independent logic shared by the Worker cron (deferral/digest timing)
 * and both clients (input validation). Nothing here reads the clock or a
 * timezone — callers pass in already-localized 'HH:MM' strings.
 */

/** True if `s` is a valid 24h 'HH:MM' string (00:00–23:59). */
export function isValidHM(s: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(s)) return false
  const h = Number(s.slice(0, 2))
  const m = Number(s.slice(3, 5))
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

/**
 * True if local time `t` ('HH:MM') falls within the quiet-hours window
 * [start, end). Handles the midnight-wrap case (e.g. 22:00–07:00). A null bound
 * or a zero-length window (start === end) means "no quiet hours" → false.
 * Lexicographic comparison is valid because all inputs are zero-padded 'HH:MM'.
 */
export function inQuietHours(
  t: string,
  start: string | null | undefined,
  end: string | null | undefined,
): boolean {
  if (!start || !end || start === end) return false
  if (start < end) return t >= start && t < end   // same-day window
  return t >= start || t < end                     // wraps past midnight
}
