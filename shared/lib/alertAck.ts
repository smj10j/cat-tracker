/**
 * Health alert acknowledgment — suppression logic shared by web + iOS.
 *
 * An acknowledgment is a statement: "I know about a weight alert of severity S
 * (direction D) on cat C, as of now." It is keyed to
 * (cat_id, alert_kind, acknowledged_severity, direction) — NOT to any particular
 * assessment computation. Both clients recompute health independently; this
 * single implementation decides whether to show the muted "acknowledged" state
 * or the full-intensity alert.
 *
 * See docs/PRDs/PRD-alert-acknowledgment.md.
 */

import type { AckRecord, AckDirection } from './types'
import type { HealthAssessment, HealthStatus, PeriodHealth } from './healthMetrics'

const RANK: Record<HealthStatus, number> = { ok: 0, watch: 1, concerning: 2, urgent: 3 }

/**
 * Direction of the alert that drove the current status: derived from the worst
 * non-ok period, falling back to cumulative-loss sign when the status came
 * purely from total loss-from-peak. A gain-watch and a loss-watch are different
 * clinical concerns even at equal severity.
 *
 * Only periods inside the trend window are considered — the same bound assessHealth
 * uses to decide escalation, so an acknowledgment's direction is derived from the
 * same evidence that produced the alert rather than from stale history.
 */
export function assessmentDirection(assessment: HealthAssessment): AckDirection {
  const worstBad = assessment.periods
    .filter((p): p is PeriodHealth =>
      p !== null && !p.skipped && p.withinTrendWindow && p.status !== 'ok')
    .sort((a, b) => Math.abs(b.changePerWeek) - Math.abs(a.changePerWeek))[0]
  if (worstBad) return worstBad.direction === 'gain' ? 'gain' : 'loss'
  // Status came from cumulative loss from the reference peak.
  return assessment.peakLossPct >= 0 ? 'loss' : 'gain'
}

/** True when an ack has passed its expiry watermark (read-side expiry). */
export function isAckExpired(ack: AckRecord, now: Date = new Date()): boolean {
  if (!ack.expires_at) return false
  return new Date(ack.expires_at.replace(' ', 'T') + 'Z').getTime() < now.getTime()
}

export type AckReason =
  | 'no_ack'                 // no active ack exists
  | 'status_ok'             // nothing to suppress (episode over)
  | 'expired'               // ack aged out
  | 'superseded_severity'   // status worsened past the acked severity
  | 'superseded_direction'  // direction flipped (loss <-> gain)
  | 'suppressed'            // show the muted acknowledged state

export interface AckApplication {
  suppressed: boolean
  reason: AckReason
}

/**
 * Decide whether the current assessment should render as acknowledged.
 *
 * suppress iff:
 *   rank(current) <= rank(acked severity)   // not worsened
 *   AND direction(current) == acked direction
 *   AND ack not expired
 */
export function applyAcknowledgment(
  assessment: HealthAssessment,
  ack: AckRecord | null | undefined,
  now: Date = new Date(),
): AckApplication {
  if (!ack || ack.status !== 'active') return { suppressed: false, reason: 'no_ack' }
  if (assessment.overallStatus === 'ok') return { suppressed: false, reason: 'status_ok' }
  if (isAckExpired(ack, now)) return { suppressed: false, reason: 'expired' }

  if (RANK[assessment.overallStatus] > RANK[ack.acknowledged_severity]) {
    return { suppressed: false, reason: 'superseded_severity' }
  }
  if (assessmentDirection(assessment) !== ack.direction) {
    return { suppressed: false, reason: 'superseded_direction' }
  }
  return { suppressed: true, reason: 'suppressed' }
}
