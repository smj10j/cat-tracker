import { useMemo } from 'react'
import type { Measurement } from '../lib/api'
import { assessHealth, type HealthAssessment } from '../lib/healthMetrics'
import { useThresholds } from '../contexts/ConfigContext'

/**
 * Wraps assessHealth with server-configured threshold overrides.
 * Components that just need a one-off assessment can still call assessHealth directly
 * with useThresholds() — this hook adds memoization.
 */
export function useHealthAssessment(measurements: Measurement[]): HealthAssessment {
  const thresholds = useThresholds()
  return useMemo(() => assessHealth(measurements, thresholds), [measurements, thresholds])
}
