import { renderHook, act } from '@testing-library/react'
import { useChartWindow } from '../../lib/useChartWindow'
import type { Measurement } from '../../lib/api'

function makeMeasurement(daysAgo: number, value: number): Measurement {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(12, 0, 0, 0) // noon UTC for timezone safety
  return {
    id: `m-${daysAgo}`,
    cat_id: 'cat-1',
    type: 'weight',
    value,
    unit: 'lbs',
    measured_at: d.toISOString(),
    notes: null,
    created_at: d.toISOString(),
  }
}

// Measurements spanning ~6 months, sorted ascending by date
const measurements: Measurement[] = [
  makeMeasurement(180, 9.0),
  makeMeasurement(150, 9.2),
  makeMeasurement(120, 9.5),
  makeMeasurement(90, 9.8),
  makeMeasurement(60, 10.0),
  makeMeasurement(30, 10.2),
  makeMeasurement(14, 10.3),
  makeMeasurement(7, 10.4),
  makeMeasurement(3, 10.5),
  makeMeasurement(1, 10.6),
].sort((a, b) => a.measured_at.localeCompare(b.measured_at))

describe('useChartWindow', () => {
  it('default range is All and returns all measurements', () => {
    const { result } = renderHook(() => useChartWindow(measurements))
    expect(result.current.range).toBe('All')
    expect(result.current.filteredData).toHaveLength(measurements.length)
  })

  it('setting range to 3M filters to last ~90 days of data', () => {
    const { result } = renderHook(() => useChartWindow(measurements))
    act(() => { result.current.setRange('3M') })
    // Should include measurements from last 90 days (60, 30, 14, 7, 3, 1 days ago)
    expect(result.current.filteredData.length).toBeGreaterThanOrEqual(5)
    expect(result.current.filteredData.length).toBeLessThan(measurements.length)
  })

  it('setting range to 1W filters to last ~7 days', () => {
    const { result } = renderHook(() => useChartWindow(measurements))
    act(() => { result.current.setRange('1W') })
    // Should include measurements from last 7 days (7, 3, 1 days ago)
    expect(result.current.filteredData.length).toBeGreaterThanOrEqual(2)
    expect(result.current.filteredData.length).toBeLessThanOrEqual(4)
  })

  it('navigate back shifts windowEnd backward by half the range', () => {
    const { result } = renderHook(() => useChartWindow(measurements))
    act(() => { result.current.setRange('1M') })
    const initialEnd = new Date(result.current.windowEnd)
    act(() => { result.current.navigate('back') })
    const newEnd = new Date(result.current.windowEnd)
    // Should have shifted back by ~15 days (half of 30)
    const diffDays = (initialEnd.getTime() - newEnd.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(15, 0)
  })

  it('navigate forward shifts windowEnd forward, capped at today', () => {
    const { result } = renderHook(() => useChartWindow(measurements))
    act(() => { result.current.setRange('1M') })
    // Navigate back first so we can go forward
    act(() => { result.current.navigate('back') })
    const afterBack = new Date(result.current.windowEnd)
    act(() => { result.current.navigate('forward') })
    const afterForward = new Date(result.current.windowEnd)
    // Should be at today (cap) or shifted forward
    expect(afterForward.getTime()).toBeGreaterThanOrEqual(afterBack.getTime())
    // Should not exceed today
    const today = new Date()
    expect(afterForward.getTime()).toBeLessThanOrEqual(today.getTime() + 1000)
  })

  it('navigate today resets windowEnd to today', () => {
    const { result } = renderHook(() => useChartWindow(measurements))
    act(() => { result.current.setRange('1M') })
    act(() => { result.current.navigate('back') })
    act(() => { result.current.navigate('back') })
    act(() => { result.current.navigate('today') })
    const now = new Date()
    const diff = Math.abs(now.getTime() - result.current.windowEnd.getTime())
    expect(diff).toBeLessThan(1000) // within 1 second
  })

  it('navigate does nothing when range is All', () => {
    const { result } = renderHook(() => useChartWindow(measurements))
    expect(result.current.range).toBe('All')
    const endBefore = result.current.windowEnd.getTime()
    act(() => { result.current.navigate('back') })
    expect(result.current.windowEnd.getTime()).toBe(endBefore)
  })

  it('hasOlderData is true when earliest measurement is before windowStart', () => {
    const { result } = renderHook(() => useChartWindow(measurements))
    act(() => { result.current.setRange('1M') })
    expect(result.current.hasOlderData).toBe(true)
  })

  it('hasNewerData is true when windowEnd is before today', () => {
    const { result } = renderHook(() => useChartWindow(measurements))
    act(() => { result.current.setRange('1M') })
    act(() => { result.current.navigate('back') })
    expect(result.current.hasNewerData).toBe(true)
  })

  it('empty measurements array returns empty filteredData without error', () => {
    const { result } = renderHook(() => useChartWindow([]))
    expect(result.current.filteredData).toHaveLength(0)
    expect(result.current.hasOlderData).toBe(false)
    expect(result.current.hasNewerData).toBe(false)
    // Should not throw when navigating
    act(() => { result.current.setRange('1M') })
    act(() => { result.current.navigate('back') })
    expect(result.current.filteredData).toHaveLength(0)
  })
})
