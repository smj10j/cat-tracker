import { useState, useMemo, useCallback } from 'react'
import type { Measurement } from './api'
import { getLocaleTickFormatter, type UserPreferences } from '@shared/lib/preferences'

export type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'All'

export const RANGE_DAYS: Record<TimeRange, number | null> = {
  '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, 'All': null,
}

export const RANGE_LABELS: Record<TimeRange, string> = {
  '1W': '1W', '1M': '1M', '3M': '3M', '6M': '6M', '1Y': '1Y', 'All': 'All',
}

export function useChartWindow(measurements: Measurement[]) {
  const [range, setRange] = useState<TimeRange>('All')
  const [windowEnd, setWindowEnd] = useState(() => new Date())

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

  return { range, setRange, windowEnd, windowStart, filteredData, navigate, hasOlderData, hasNewerData }
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
