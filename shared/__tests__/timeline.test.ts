import { describe, it, expect } from 'vitest'
import { groupTimelineByDay } from '../lib/formatting'
import { US_DEFAULTS } from '../lib/preferences'
import type { Measurement, JournalEntry } from '../lib/types'

const prefs = US_DEFAULTS

function meas(id: string, measured_at: string): Measurement {
  return { id, cat_id: 'c1', type: 'weight', value: 9, unit: 'lbs', measured_at, notes: null, created_at: measured_at }
}
function entry(id: string, occurred_at: string, tags: string[] | null = null): JournalEntry {
  return { id, cat_id: 'c1', user_id: 'u1', author_name: 'Sam', occurred_at, text: 'note ' + id, tags, photo_url: null, created_at: occurred_at, updated_at: occurred_at }
}

describe('groupTimelineByDay', () => {
  it('interleaves measurements and journal entries, newest first within each day', () => {
    const groups = groupTimelineByDay(
      [meas('m1', '2026-07-02 10:00:00'), meas('m2', '2026-07-01 08:00:00')],
      [entry('j1', '2026-07-02 14:00:00'), entry('j2', '2026-07-01 20:00:00')],
      prefs,
    )
    expect(groups.map(g => g.dateStr)).toEqual(['2026-07-02', '2026-07-01'])

    // Day 1: journal (14:00) before measurement (10:00)
    expect(groups[0]!.items[0]!.kind).toBe('journal')
    expect(groups[0]!.items[1]!.kind).toBe('measurement')
    const j1 = groups[0]!.items[0]!
    expect(j1.kind === 'journal' && j1.entry.id).toBe('j1')

    // Day 2: journal (20:00) before measurement (08:00)
    expect(groups[1]!.items[0]!.kind).toBe('journal')
    expect(groups[1]!.items[1]!.kind).toBe('measurement')
  })

  it('works with measurements only', () => {
    const groups = groupTimelineByDay([meas('m1', '2026-07-02 10:00:00')], [], prefs)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.items).toHaveLength(1)
    expect(groups[0]!.items[0]!.kind).toBe('measurement')
  })

  it('works with journal entries only', () => {
    const groups = groupTimelineByDay([], [entry('j1', '2026-07-02 14:00:00', ['hiding'])], prefs)
    expect(groups).toHaveLength(1)
    const it0 = groups[0]!.items[0]!
    expect(it0.kind === 'journal' && it0.entry.tags).toEqual(['hiding'])
  })

  it('returns empty for no data', () => {
    expect(groupTimelineByDay([], [], prefs)).toEqual([])
  })
})
