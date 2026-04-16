/**
 * Health status icon — Phosphor-based replacement for OS emoji.
 *
 * Used in system chrome (badges, nav, alerts). Historical measurement
 * entries and chart data points keep emoji per PRD §10.
 */
import { CheckCircle, Eye, Warning, Siren } from '@phosphor-icons/react'
import type { HealthStatus } from '@shared/lib/healthMetrics'
import { STATUS_COLORS } from '@shared/lib/healthMetrics'

const ICON_MAP: Record<HealthStatus, typeof CheckCircle> = {
  ok: CheckCircle,
  watch: Eye,
  concerning: Warning,
  urgent: Siren,
}

interface StatusIconProps {
  status: HealthStatus
  size?: number
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'
  className?: string
}

export default function StatusIcon({ status, size = 20, weight = 'fill', className }: StatusIconProps) {
  const Icon = ICON_MAP[status]
  const color = STATUS_COLORS[status]
  return <Icon size={size} weight={weight} color={color} className={className} />
}
