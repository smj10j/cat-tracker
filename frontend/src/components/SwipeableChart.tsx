import { useRef, useState } from 'react'

interface Props {
  onSwipeLeft: () => void
  onSwipeRight: () => void
  enabled: boolean
  children: React.ReactNode
}

export default function SwipeableChart({ onSwipeLeft, onSwipeRight, enabled, children }: Props) {
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const [translateX, setTranslateX] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  if (!enabled) {
    return <>{children}</>
  }

  return (
    <div
      onTouchStart={(e) => {
        const touch = e.touches[0]
        if (touch) {
          touchStart.current = { x: touch.clientX, y: touch.clientY }
        }
        setIsTransitioning(false)
      }}
      onTouchMove={(e) => {
        if (!touchStart.current) return
        const touch = e.touches[0]
        if (!touch) return
        const deltaX = touch.clientX - touchStart.current.x
        const deltaY = touch.clientY - touchStart.current.y
        // Only apply visual feedback if horizontal movement dominates
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
          setTranslateX(deltaX * 0.3)
        }
      }}
      onTouchEnd={(e) => {
        if (!touchStart.current) return
        const touch = e.changedTouches[0]
        if (!touch) { touchStart.current = null; return }
        const deltaX = touch.clientX - touchStart.current.x
        const deltaY = touch.clientY - touchStart.current.y
        touchStart.current = null

        if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 30) {
          if (deltaX < 0) {
            onSwipeLeft()
          } else {
            onSwipeRight()
          }
        }

        // Animate back to 0
        setIsTransitioning(true)
        setTranslateX(0)
        setTimeout(() => setIsTransitioning(false), 200)
      }}
    >
      <div
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isTransitioning ? 'transform 0.2s ease-out' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  )
}
