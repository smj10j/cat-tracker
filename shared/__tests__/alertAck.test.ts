import { describe, it, expect } from 'vitest'
import { applyAcknowledgment, assessmentDirection, isAckExpired } from '../lib/alertAck'
import type { HealthAssessment, HealthStatus, PeriodHealth } from '../lib/healthMetrics'
import type { AckRecord } from '../lib/types'

function period(status: HealthStatus, direction: 'loss' | 'gain' | 'stable'): PeriodHealth {
  return {
    status,
    absoluteChange: direction === 'loss' ? -0.4 : direction === 'gain' ? 0.4 : 0,
    changePercent: direction === 'loss' ? -4 : direction === 'gain' ? 4 : 0,
    changePerWeek: direction === 'loss' ? -3 : direction === 'gain' ? 3 : 0,
    days: 7,
    direction,
    skipped: false,
  }
}

function assess(overallStatus: HealthStatus, direction: 'loss' | 'gain', totalLossOnly = false): HealthAssessment {
  return {
    overallStatus,
    periods: totalLossOnly
      ? [null, period('ok', 'stable')]
      : [null, period(overallStatus === 'ok' ? 'ok' : overallStatus, direction)],
    peakLossPct: direction === 'loss' ? 8 : -8,
    referencePeak: 10,
    summary: '',
  }
}

function mkAck(overrides: Partial<AckRecord> = {}): AckRecord {
  return {
    id: 'a1', cat_id: 'c1', alert_kind: 'weight',
    acknowledged_severity: 'watch', direction: 'loss',
    acknowledged_by: 'u1', acknowledged_by_name: 'Sam',
    note: null, latest_measured_at: '2026-06-01 00:00:00',
    context: null, status: 'active', expires_at: null,
    created_at: '2026-06-01 00:00:00', ended_at: null,
    ...overrides,
  }
}

describe('assessmentDirection', () => {
  it('reads the worst non-ok period direction', () => {
    expect(assessmentDirection(assess('watch', 'loss'))).toBe('loss')
    expect(assessmentDirection(assess('watch', 'gain'))).toBe('gain')
  })
  it('falls back to cumulative-loss sign when status came from total loss', () => {
    const a = assess('watch', 'loss', true) // no non-ok period; peakLossPct > 0
    expect(assessmentDirection(a)).toBe('loss')
  })
})

describe('applyAcknowledgment — re-trigger table', () => {
  it('no ack → full alert', () => {
    expect(applyAcknowledgment(assess('watch', 'loss'), null).suppressed).toBe(false)
  })

  it('same severity + direction → suppressed', () => {
    const r = applyAcknowledgment(assess('watch', 'loss'), mkAck())
    expect(r.suppressed).toBe(true)
    expect(r.reason).toBe('suppressed')
  })

  it('new measurement at same severity → still suppressed (identity is severity+direction)', () => {
    // A different assessment object, same status/direction, still matches the ack.
    expect(applyAcknowledgment(assess('watch', 'loss'), mkAck()).suppressed).toBe(true)
  })

  it('status worsens past acked severity → superseded', () => {
    const r = applyAcknowledgment(assess('concerning', 'loss'), mkAck({ acknowledged_severity: 'watch' }))
    expect(r.suppressed).toBe(false)
    expect(r.reason).toBe('superseded_severity')
  })

  it('direction flips (loss ack, gain now) at equal severity → superseded', () => {
    const r = applyAcknowledgment(assess('watch', 'gain'), mkAck({ direction: 'loss' }))
    expect(r.suppressed).toBe(false)
    expect(r.reason).toBe('superseded_direction')
  })

  it('status improves but still non-ok (concerning ack, now watch) → suppressed', () => {
    const r = applyAcknowledgment(assess('watch', 'loss'), mkAck({ acknowledged_severity: 'concerning' }))
    expect(r.suppressed).toBe(true)
  })

  it('status returns to ok → not suppressed (episode over)', () => {
    const r = applyAcknowledgment(assess('ok', 'loss'), mkAck())
    expect(r.suppressed).toBe(false)
    expect(r.reason).toBe('status_ok')
  })

  it('expired ack → full alert', () => {
    const past = '2020-01-01 00:00:00'
    const r = applyAcknowledgment(assess('watch', 'loss'), mkAck({ expires_at: past }))
    expect(r.suppressed).toBe(false)
    expect(r.reason).toBe('expired')
  })

  it('non-active ack (withdrawn) → full alert', () => {
    const r = applyAcknowledgment(assess('watch', 'loss'), mkAck({ status: 'withdrawn' }))
    expect(r.suppressed).toBe(false)
    expect(r.reason).toBe('no_ack')
  })
})

describe('isAckExpired', () => {
  it('null expiry never expires', () => {
    expect(isAckExpired(mkAck({ expires_at: null }))).toBe(false)
  })
  it('future expiry not expired', () => {
    const future = new Date(Date.now() + 86400000).toISOString().replace('T', ' ').slice(0, 19)
    expect(isAckExpired(mkAck({ expires_at: future }))).toBe(false)
  })
  it('past expiry is expired', () => {
    expect(isAckExpired(mkAck({ expires_at: '2000-01-01 00:00:00' }))).toBe(true)
  })
})
