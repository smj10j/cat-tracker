import type { TimeRange } from '../lib/useChartWindow'
import { RANGE_LABELS } from '../lib/useChartWindow'

const RANGES: TimeRange[] = ['1W', '1M', '3M', '6M', '1Y', 'All']

interface Props {
  range: TimeRange
  onRangeChange: (r: TimeRange) => void
  onNavigate: (dir: 'back' | 'forward' | 'today') => void
  hasOlderData: boolean
  hasNewerData: boolean
}

export default function ChartRangeSelector({ range, onRangeChange, onNavigate, hasOlderData, hasNewerData }: Props) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      {/* Back chevron */}
      <button
        onClick={() => onNavigate('back')}
        disabled={!hasOlderData}
        className="flex items-center justify-center min-h-[44px] min-w-[32px] rounded-lg text-sm font-bold transition-opacity"
        style={{
          color: hasOlderData ? 'var(--color-ink-mid)' : 'var(--color-ink-dim)',
          opacity: hasOlderData ? 1 : 0.3,
        }}
        aria-label="Navigate back in time"
      >
        ‹
      </button>

      {/* Range pills — scrollable */}
      <div className="flex-1 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1">
          {RANGES.map((r) => {
            const active = r === range
            return (
              <button
                key={r}
                onClick={() => onRangeChange(r)}
                className="min-h-[44px] px-3 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap"
                style={{
                  background: active ? 'rgba(168,85,247,0.2)' : 'var(--color-surface-hi)',
                  color: active ? '#c084fc' : 'var(--color-ink-dim)',
                  border: active ? '1px solid rgba(168,85,247,0.4)' : '1px solid transparent',
                }}
              >
                {RANGE_LABELS[r]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Today pill */}
      {hasNewerData && (
        <button
          onClick={() => onNavigate('today')}
          className="min-h-[36px] px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap"
          style={{
            background: 'rgba(251,146,60,0.15)',
            color: '#fb923c',
            border: '1px solid rgba(251,146,60,0.3)',
          }}
        >
          Today
        </button>
      )}

      {/* Forward chevron */}
      <button
        onClick={() => onNavigate('forward')}
        disabled={!hasNewerData}
        className="flex items-center justify-center min-h-[44px] min-w-[32px] rounded-lg text-sm font-bold transition-opacity"
        style={{
          color: hasNewerData ? 'var(--color-ink-mid)' : 'var(--color-ink-dim)',
          opacity: hasNewerData ? 1 : 0.3,
        }}
        aria-label="Navigate forward in time"
      >
        ›
      </button>
    </div>
  )
}
