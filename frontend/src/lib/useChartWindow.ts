import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { Measurement } from './api'
import { getLocaleTickFormatter, type UserPreferences } from '@shared/lib/preferences'
import { DEFAULT_CHART_WINDOW_DAYS } from '@shared/lib/formatting'

export type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'All'

export const RANGE_DAYS: Record<TimeRange, number | null> = {
  '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, 'All': null,
}

export const RANGE_LABELS: Record<TimeRange, string> = {
  '1W': '1W', '1M': '1M', '3M': '3M', '6M': '6M', '1Y': '1Y', 'All': 'All',
}

/**
 * Default range for a series: the last 6 months, or the whole record when it is shorter.
 * A multi-year record opened at 'All' compresses recent movement into an unreadable sliver;
 * 6 months is the span most weight questions are actually about. Computed once, on mount —
 * the selector stays authoritative afterwards so adding a measurement never yanks the range
 * out from under the user.
 */
export function defaultRangeFor(measurements: Measurement[]): TimeRange {
  if (measurements.length === 0) return 'All'
  let earliest = Infinity
  let latest = -Infinity
  for (const m of measurements) {
    const t = new Date(m.measured_at).getTime()
    if (Number.isNaN(t)) continue
    if (t < earliest) earliest = t
    if (t > latest) latest = t
  }
  if (!Number.isFinite(earliest) || !Number.isFinite(latest)) return 'All'
  const spanDays = (latest - earliest) / 86400_000
  return spanDays > DEFAULT_CHART_WINDOW_DAYS ? '6M' : 'All'
}

export function useChartWindow(measurements: Measurement[]) {
  const [range, setRange] = useState<TimeRange>(() => defaultRangeFor(measurements))
  const [windowEnd, setWindowEnd] = useState(() => new Date())

  // Callers that mount before their data arrives start with an empty array, so the lazy
  // initializer above sees nothing to measure. Apply the default once, when real data first
  // shows up — and never again, so a later measurement can't move a range the user picked.
  const defaultApplied = useRef(measurements.length > 0)
  useEffect(() => {
    if (defaultApplied.current || measurements.length === 0) return
    defaultApplied.current = true
    setRange(defaultRangeFor(measurements))
  }, [measurements])

  const selectRange = useCallback((next: TimeRange) => {
    defaultApplied.current = true
    setRange(next)
  }, [])

  const windowStart = useMemo(() => {
    const days = RANGE_DAYS[range]
    if (days === null) return null
    const d = new Date(windowEnd)
    d.setDate(d.getDate() - days)
    return d
  }, [range, windowEnd])

  const filteredData = useMemo(() => {
    if (!windowStart) return measurements
    return measurements.filter(m => {
      const d = new Date(m.measured_at)
      return d >= windowStart && d <= windowEnd
    })
  }, [measurements, windowStart, windowEnd])

  const navigate = useCallback((direction: 'back' | 'forward' | 'today') => {
    if (direction === 'today') { setWindowEnd(new Date()); return }
    const days = RANGE_DAYS[range]
    if (days === null) return
    const shift = Math.floor(days / 2)
    setWindowEnd(prev => {
      const next = new Date(prev)
      next.setDate(next.getDate() + (direction === 'forward' ? shift : -shift))
      const today = new Date()
      return next > today ? today : next
    })
  }, [range])

  const hasOlderData = useMemo(() => {
    if (!windowStart || measurements.length === 0) return false
    return new Date(measurements[0]!.measured_at) < windowStart
  }, [measurements, windowStart])

  const hasNewerData = useMemo(() => {
    if (range === 'All') return false
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const end = new Date(windowEnd); end.setHours(0, 0, 0, 0)
    return end < today
  }, [windowEnd, range])

  return { range, setRange: selectRange, windowEnd, windowStart, filteredData, navigate, hasOlderData, hasNewerData }
}

/** @deprecated Use getLocaleTickFormatter from shared/lib/preferences instead */
export function getTickFormatter(range: TimeRange, prefs?: UserPreferences): (iso: string) => string {
  if (prefs) return getLocaleTickFormatter(range, prefs)
  // Fallback for callers that haven't migrated yet
  return (iso: string) => {
    const d = new Date(iso)
    switch (range) {
      case '1W': return d.toLocaleDateString('en-US', { weekday: 'short' })
      case '1M': return d.toLocaleDateString('en-US', { day: 'numeric' })
      case '3M': return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      case '6M': return d.toLocaleDateString('en-US', { month: 'short' })
      case '1Y': return d.toLocaleDateString('en-US', { month: 'short' })
      case 'All':
      default: return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }
}
