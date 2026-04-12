import { useState, useEffect, useRef } from 'react'

interface Props {
  onClick: () => void
  visible: boolean
}

const HINT_KEY = 'chart-expand-hint-seen'

export default function ChartExpandButton({ onClick, visible }: Props) {
  const [showHint, setShowHint] = useState(false)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!visible) return
    try {
      if (localStorage.getItem(HINT_KEY)) return
    } catch { return }

    showTimer.current = setTimeout(() => {
      setShowHint(true)
      try { localStorage.setItem(HINT_KEY, '1') } catch {}
      dismissTimer.current = setTimeout(() => setShowHint(false), 4000)
    }, 1000)

    return () => {
      if (showTimer.current) clearTimeout(showTimer.current)
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
    }
  }, [visible])

  if (!visible) return null

  return (
    <div className="absolute top-1 right-1 z-10">
      <button
        onClick={onClick}
        className="flex items-center justify-center transition-all hover:scale-110"
        style={{
          width: 44,
          height: 44,
          color: 'var(--color-ink-mid)',
          fontSize: 18,
        }}
        aria-label="Expand chart to full screen"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="14 2 18 2 18 6" />
          <polyline points="6 18 2 18 2 14" />
          <line x1="18" y1="2" x2="12" y2="8" />
          <line x1="2" y1="18" x2="8" y2="12" />
        </svg>
      </button>
      {showHint && (
        <div
          className="absolute right-0 top-full mt-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap animate-fade-in"
          style={{
            background: 'var(--color-tooltip-bg)',
            border: '1px solid var(--color-tooltip-border)',
            color: 'var(--color-ink-mid)',
            backdropFilter: 'blur(10px)',
          }}
          onClick={() => setShowHint(false)}
        >
          Tap to expand chart
        </div>
      )}
    </div>
  )
}
