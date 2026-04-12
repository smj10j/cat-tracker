/**
 * Localization & Regional Preferences — shared between frontend/ and app/.
 *
 * Single source of truth for preference types, locale derivation,
 * and format helpers. See docs/PRDs/PRD-localization-preferences.md.
 */

// -- Types --

export type WeightUnit = 'lbs' | 'kg'
export type DateFormat = 'MDY' | 'DMY' | 'YMD'
export type TimeFormat = '12h' | '24h'

export interface UserPreferences {
  weightUnit: WeightUnit
  dateFormat: DateFormat
  timeFormat: TimeFormat
}

// -- Schema --

export interface PreferenceDef<T> {
  key: string
  options: readonly T[]
  deriveDefault: (locale: string) => T
}

function regionFromLocale(locale: string): string {
  // "en-US" -> "US", "de" -> "DE" (Intl fallback), "en" -> "US"
  const parts = locale.split('-')
  if (parts.length >= 2 && parts[1]!.length === 2) return parts[1]!.toUpperCase()
  // Use Intl to resolve region for bare language tags
  try {
    const resolved = new Intl.Locale(locale).maximize()
    return resolved.region?.toUpperCase() ?? 'US'
  } catch {
    return 'US'
  }
}

function deriveTimeFormat(locale: string): TimeFormat {
  try {
    const resolved = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions() as { hourCycle?: string }
    return resolved.hourCycle === 'h12' || resolved.hourCycle === 'h11' ? '12h' : '24h'
  } catch {
    return '12h'
  }
}

function deriveDateFormat(locale: string): DateFormat {
  try {
    const parts = new Intl.DateTimeFormat(locale).formatToParts(new Date(2026, 0, 15))
    const order = parts.filter(p => ['month', 'day', 'year'].includes(p.type)).map(p => p.type)
    if (order[0] === 'year') return 'YMD'
    if (order[0] === 'day') return 'DMY'
    return 'MDY'
  } catch {
    return 'MDY'
  }
}

export const PREFERENCE_DEFS = {
  weightUnit: {
    key: 'weightUnit',
    options: ['lbs', 'kg'] as const,
    deriveDefault: (locale: string): WeightUnit => {
      const region = regionFromLocale(locale)
      // US, Liberia, Myanmar use imperial. Canada: pet owners commonly use lbs.
      return ['US', 'LR', 'MM', 'CA'].includes(region) ? 'lbs' : 'kg'
    },
  },
  dateFormat: {
    key: 'dateFormat',
    options: ['MDY', 'DMY', 'YMD'] as const,
    deriveDefault: (locale: string): DateFormat => deriveDateFormat(locale || 'en-US'),
  },
  timeFormat: {
    key: 'timeFormat',
    options: ['12h', '24h'] as const,
    deriveDefault: (locale: string): TimeFormat => deriveTimeFormat(locale || 'en-US'),
  },
} as const satisfies Record<string, PreferenceDef<unknown>>

// -- Derivation --

export function deriveDefaults(locale: string): UserPreferences {
  const safeLocale = locale || 'en-US'
  return {
    weightUnit: PREFERENCE_DEFS.weightUnit.deriveDefault(safeLocale),
    dateFormat: PREFERENCE_DEFS.dateFormat.deriveDefault(safeLocale),
    timeFormat: PREFERENCE_DEFS.timeFormat.deriveDefault(safeLocale),
  }
}

// -- Weight conversion --

const LBS_PER_KG = 2.20462

/** Convert weight between lbs and kg. Rounds to 2 decimal places. Identity if from === to. */
export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value
  const converted = from === 'lbs' ? value / LBS_PER_KG : value * LBS_PER_KG
  return Math.round(converted * 100) / 100
}

/**
 * Format a weight value for display, converting from stored unit to preferred unit.
 * e.g. formatWeight(9.4, 'lbs', prefs with kg) => "4.26 kg"
 */
export function formatWeight(value: number, fromUnit: string, prefs: UserPreferences): string {
  const from = (fromUnit === 'kg' ? 'kg' : 'lbs') as WeightUnit
  const converted = convertWeight(value, from, prefs.weightUnit)
  return `${converted} ${prefs.weightUnit}`
}

/** Format weight value only (no unit label). Converts from stored unit to preferred. */
export function formatWeightValue(value: number, fromUnit: string, prefs: UserPreferences): number {
  const from = (fromUnit === 'kg' ? 'kg' : 'lbs') as WeightUnit
  return convertWeight(value, from, prefs.weightUnit)
}

// -- Date formatting --

/** Format a date for display: "Mar 7, 2026" / "7 Mar 2026" / "2026-03-07" */
export function formatDate(iso: string, prefs: UserPreferences): string {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  if (isNaN(d.getTime())) return ''
  switch (prefs.dateFormat) {
    case 'DMY': return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    case 'YMD': return d.toLocaleDateString('sv-SE') // YYYY-MM-DD
    case 'MDY':
    default: return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
}

/** Chart-friendly short date: "Mar 7" / "7 Mar" / "03-07" */
export function formatDateShort(iso: string, prefs: UserPreferences): string {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  if (isNaN(d.getTime())) return ''
  switch (prefs.dateFormat) {
    case 'DMY': return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    case 'YMD': return d.toLocaleDateString('sv-SE').slice(5) // MM-DD
    case 'MDY':
    default: return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

/** Day label with weekday: "Mon, Mar 7" / "Mon, 7 Mar" / "Mon, 03-07" */
export function formatDateWithWeekday(iso: string, prefs: UserPreferences): string {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  if (isNaN(d.getTime())) return ''
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
  switch (prefs.dateFormat) {
    case 'DMY': return `${weekday}, ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    case 'YMD': return `${weekday}, ${d.toLocaleDateString('sv-SE').slice(5)}`
    case 'MDY':
    default: return `${weekday}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }
}

/** Full date with year and weekday: "Mon, Mar 7, 2026" etc. */
export function formatDateFull(iso: string, prefs: UserPreferences): string {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  if (isNaN(d.getTime())) return ''
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
  switch (prefs.dateFormat) {
    case 'DMY': return `${weekday}, ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    case 'YMD': return `${weekday}, ${d.toLocaleDateString('sv-SE')}`
    case 'MDY':
    default: return `${weekday}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }
}

/** Format time: "3:45 PM" or "15:45" */
export function formatTime(iso: string, prefs: UserPreferences): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  if (prefs.timeFormat === '24h') {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** Format combined date + time */
export function formatDateTime(iso: string, prefs: UserPreferences): string {
  return `${formatDate(iso, prefs)} at ${formatTime(iso, prefs)}`
}

// -- Chart tick formatter (locale-aware replacement for useChartWindow.getTickFormatter) --

export function getLocaleTickFormatter(range: string, prefs: UserPreferences): (iso: string) => string {
  return (iso: string) => {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    switch (range) {
      case '1W':
        return d.toLocaleDateString('en-US', { weekday: 'short' })
      case '1M':
        return String(d.getDate())
      case '3M':
        return formatDateShort(iso, prefs)
      case '6M':
      case '1Y':
        return d.toLocaleDateString('en-US', { month: 'short' })
      case 'All':
      default:
        return formatDateShort(iso, prefs)
    }
  }
}

// -- Default preferences (US fallback, same as pre-migration behavior) --

export const US_DEFAULTS: UserPreferences = {
  weightUnit: 'lbs',
  dateFormat: 'MDY',
  timeFormat: '12h',
}
