/**
 * Shared formatting helpers — used by both frontend/ and app/.
 *
 * Single source of truth for date/time display formatting, measurement grouping,
 * and care schedule label generation.
 */

import type { UserPreferences } from './preferences'
import type { Measurement, DayGroup, JournalEntry, TimelineItem, TimelineDayGroup } from './types'
import { formatDateShort, formatDateWithWeekday } from './preferences'
import { utcToLocal } from './dates'

/**
 * Format a time-part string ("HH:MM") for display, respecting 12h/24h preference.
 */
export function formatTimeFromParts(timePart: string, prefs: UserPreferences): string {
  const [h, m] = timePart.split(':')
  const hour = parseInt(h ?? '0', 10)
  const minute = m ?? '00'
  if (prefs.timeFormat === '24h') return `${String(hour).padStart(2, '0')}:${minute}`
  const ampm = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12}:${minute} ${ampm}`
}

/**
 * Get today's date as a YYYY-MM-DD string in local time.
 */
export function todayLocalDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Get the current hour (0-23) in local time.
 */
export function currentHour(): number {
  return new Date().getHours()
}

/**
 * Round a time string "HH:MM" to the nearest hour (rounds up at 30+ minutes).
 */
export function roundToHour(time: string): string {
  const parts = time.split(':')
  const hour = parseInt(parts[0] ?? '9', 10)
  const min = parseInt(parts[1] ?? '0', 10)
  const rounded = min >= 30 ? (hour + 1) % 24 : hour
  return `${String(rounded).padStart(2, '0')}:00`
}

/**
 * Format a Date as a local datetime string for datetime-local inputs ("YYYY-MM-DDTHH:MM").
 */
export function toLocalDatetimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Build an ISO timestamp from a local date string and hour number.
 */
export function buildMeasuredAt(localDate: string, hour: number): string {
  const [y, mo, d] = localDate.split('-').map(Number)
  return new Date(y!, mo! - 1, d!, hour, 0, 0).toISOString()
}

/**
 * Format an hour (0-23) for display, respecting 12h/24h preference.
 */
export function formatHour(hour: number, prefs: UserPreferences): string {
  if (prefs.timeFormat === '24h') return `${String(hour).padStart(2, '0')}:00`
  if (hour === 0) return '12:00 AM'
  if (hour < 12) return `${hour}:00 AM`
  if (hour === 12) return '12:00 PM'
  return `${hour - 12}:00 PM`
}

/** Helper: get YYYY-MM-DD for yesterday in local time. */
function yesterdayLocalDate(): string {
  const yest = new Date(Date.now() - 86400000)
  return `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`
}

/** Helper: get YYYY-MM-DD for tomorrow in local time. */
function tomorrowLocalDate(): string {
  const tom = new Date(Date.now() + 86400000)
  return `${tom.getFullYear()}-${String(tom.getMonth() + 1).padStart(2, '0')}-${String(tom.getDate()).padStart(2, '0')}`
}

/**
 * Format a date string for day grouping: "Today", "Yesterday", or weekday + date.
 */
export function formatDayLabel(dateStr: string, prefs: UserPreferences): string {
  if (dateStr === todayLocalDate()) return 'Today'
  if (dateStr === yesterdayLocalDate()) return 'Yesterday'
  return formatDateWithWeekday(dateStr, prefs)
}

/**
 * Group measurements by calendar date, sorted descending.
 */
export function groupByDay(measurements: Measurement[], prefs: UserPreferences): DayGroup[] {
  const map = new Map<string, Measurement[]>()
  for (const m of measurements) {
    const dateStr = new Date(m.measured_at).toLocaleDateString('en-CA')
    const bucket = map.get(dateStr) ?? []
    bucket.push(m)
    map.set(dateStr, bucket)
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateStr, items]) => ({
      dateStr,
      label: formatDayLabel(dateStr, prefs),
      items: items.sort((a, b) => b.measured_at.localeCompare(a.measured_at)),
    }))
}

/**
 * Group measurements AND journal entries into one day-grouped timeline
 * (PRD-notes-journal). Measurements sort by `measured_at`, journal entries by
 * `occurred_at`; within a day, newest first. Used by the History view so
 * observations interleave with measurements.
 */
export function groupTimelineByDay(
  measurements: Measurement[],
  entries: JournalEntry[],
  prefs: UserPreferences,
): TimelineDayGroup[] {
  const items: TimelineItem[] = [
    ...measurements.map((m): TimelineItem => ({ kind: 'measurement', at: m.measured_at, measurement: m })),
    ...entries.map((e): TimelineItem => ({ kind: 'journal', at: e.occurred_at, entry: e })),
  ]
  const map = new Map<string, TimelineItem[]>()
  for (const it of items) {
    const dateStr = new Date(it.at).toLocaleDateString('en-CA')
    const bucket = map.get(dateStr) ?? []
    bucket.push(it)
    map.set(dateStr, bucket)
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateStr, its]) => ({
      dateStr,
      label: formatDayLabel(dateStr, prefs),
      items: its.sort((a, b) => b.at.localeCompare(a.at)),
    }))
}

/**
 * Format the next due time for a medication: "Today at 9:00 AM", "Tomorrow at 2:30 PM", etc.
 */
export function formatNextDue(nextDueAt: string | null | undefined, prefs: UserPreferences): string {
  if (!nextDueAt) return 'No upcoming dose'
  const { date: datePart, time: timePart } = utcToLocal(nextDueAt)
  if (!datePart) return 'Upcoming'
  const today = todayLocalDate()
  const tomorrow = tomorrowLocalDate()
  const timeStr = formatTimeFromParts(timePart ?? '09:00', prefs)
  if (datePart === today) return `Today at ${timeStr}`
  if (datePart === tomorrow) return `Tomorrow at ${timeStr}`
  return formatDateShort(datePart, prefs) + ` at ${timeStr}`
}

/**
 * Format a medication frequency for short display.
 */
export function formatFreqShort(frequency: string, frequencyDays?: number | null): string {
  const labels: Record<string, string> = {
    daily: 'daily', twice_daily: 'twice daily', weekly: 'weekly', monthly: 'monthly',
  }
  if (frequency === 'custom' && frequencyDays) {
    if (frequencyDays === 365) return 'yearly'
    if (frequencyDays === 1095) return 'every 3 years'
    return `every ${frequencyDays} days`
  }
  return labels[frequency] ?? frequency
}

/**
 * Format a past or current due_at time: "Today at 9:00 AM", "Yesterday at 2:30 PM", etc.
 */
export function formatDueAt(dueAt: string, prefs: UserPreferences): string {
  const { date: datePart, time: timePart } = utcToLocal(dueAt)
  if (!datePart || !timePart) return dueAt
  const today = todayLocalDate()
  const yesterday = yesterdayLocalDate()
  const timeStr = formatTimeFromParts(timePart, prefs)
  if (datePart === today) return `Today at ${timeStr}`
  if (datePart === yesterday) return `Yesterday at ${timeStr}`
  return formatDateShort(datePart, prefs) + ` at ${timeStr}`
}

/**
 * Format a future due_at time: "Today at 9:00 AM", "Tomorrow at 2:30 PM", etc.
 */
export function formatFutureDueAt(dueAt: string, prefs: UserPreferences): string {
  const { date: datePart, time: timePart } = utcToLocal(dueAt)
  if (!datePart || !timePart) return dueAt
  const today = todayLocalDate()
  const tomorrow = tomorrowLocalDate()
  const timeStr = formatTimeFromParts(timePart, prefs)
  if (datePart === today) return `Today at ${timeStr}`
  if (datePart === tomorrow) return `Tomorrow at ${timeStr}`
  return formatDateWithWeekday(datePart, prefs) + ` at ${timeStr}`
}

/**
 * Format a cat's sex and neuter status for display.
 * e.g. "Female · Spayed", "Male · Intact", "Unknown"
 */
export function formatSexNeuter(sex: string | null, isNeutered: number | null): string {
  if (!sex && isNeutered === null) return 'Unknown'
  const sexStr = sex ?? 'Unknown sex'
  if (isNeutered === 1) {
    const neuterStr = sex === 'Female' ? 'Spayed' : 'Neutered'
    return `${sexStr} · ${neuterStr}`
  }
  if (isNeutered === 0) return `${sexStr} · Intact`
  return sexStr
}

/**
 * Default chart lookback, in days. A multi-year record rendered end-to-end compresses recent
 * movement into an unreadable sliver; six months is the span most weight questions are about.
 * Shared so web (range selector default) and iOS (data slice) cannot drift apart.
 */
export const DEFAULT_CHART_WINDOW_DAYS = 180

/**
 * The last DEFAULT_CHART_WINDOW_DAYS of a series, or the whole series when it is shorter —
 * "the last 6 months or the range of data we have, whichever is shorter".
 *
 * The window is anchored to `now` rather than to the newest measurement, so a chart of a record
 * that stopped being updated correctly reads as empty-at-the-right rather than silently
 * re-centering on stale data. Returns the input untouched when nothing would be cut.
 */
export function sliceToDefaultChartWindow<T extends { measured_at: string }>(
  measurements: T[],
  windowDays: number = DEFAULT_CHART_WINDOW_DAYS,
): T[] {
  if (measurements.length === 0) return measurements
  const cutoff = Date.now() - windowDays * 86400_000
  const windowed = measurements.filter((m) => new Date(m.measured_at).getTime() >= cutoff)
  // Never hand back an empty chart: if every measurement predates the window, the whole
  // (short, historical) record is more useful than nothing.
  return windowed.length > 0 ? windowed : measurements
}
