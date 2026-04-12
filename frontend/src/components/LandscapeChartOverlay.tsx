import { useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}

export default function LandscapeChartOverlay({ title, subtitle, onClose, children }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const pushedState = useRef(false)

  const handleClose = useCallback(() => {
    if (pushedState.current) {
      pushedState.current = false
      window.history.back()
    }
    onClose()
  }, [onClose])

  // Push history state so back button closes overlay
  useEffect(() => {
    window.history.pushState({ chartFullScreen: true }, '')
    pushedState.current = true

    const onPopState = (_e: PopStateEvent) => {
      if (pushedState.current) {
        pushedState.current = false
        onClose()
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      if (pushedState.current) {
        pushedState.current = false
        window.history.back()
      }
    }
  }, [onClose])

  // Escape key closes overlay
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [handleClose])

  // Trap focus
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    overlayRef.current?.focus()
    return () => prev?.focus?.()
  }, [])

  // Close overlay if QuickAdd opens (prevent stacking modals)
  useEffect(() => {
    const onQuickAdd = () => handleClose()
    window.addEventListener('openQuickAdd', onQuickAdd)
    return () => window.removeEventListener('openQuickAdd', onQuickAdd)
  }, [handleClose])

  const overlay = (
    <div
      ref={overlayRef}
      tabIndex={-1}
      role="dialog"
      aria-label={`${title} chart, full screen`}
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        outline: 'none',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--color-rim)' }}
      >
        <div className="flex items-center gap-2">
          <span className="font-display font-semibold text-ink">{title}</span>
          {subtitle && (
            <>
              <span className="text-ink-dim">&middot;</span>
              <span className="text-ink-mid text-sm">{subtitle}</span>
            </>
          )}
        </div>
        <button
          onClick={handleClose}
          className="flex items-center justify-center transition-colors"
          style={{
            width: 44,
            height: 44,
            color: 'var(--color-ink-mid)',
            fontSize: 20,
          }}
          aria-label="Close full-screen chart"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="4" x2="16" y2="16" />
            <line x1="16" y1="4" x2="4" y2="16" />
          </svg>
        </button>
      </div>

      {/* Chart area — fills remaining space */}
      <div className="flex-1 px-4 py-3 overflow-hidden">
        {children}
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
