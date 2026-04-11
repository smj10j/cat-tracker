import { useEffect } from 'react'

/**
 * On mobile browsers, the virtual keyboard can cover focused inputs.
 * This hook listens for focusin events and scrolls the focused element
 * into view after the keyboard animation finishes.
 *
 * Skips elements inside position:fixed containers (bottom sheets handle
 * their own scrolling via max-height + overflow-y: auto).
 */
export function useKeyboardScroll() {
  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (!isMobile) return

    function handleFocusIn(e: FocusEvent) {
      const target = e.target as HTMLElement | null
      if (!target) return

      const tag = target.tagName
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return

      // Skip if inside a fixed-position container (bottom sheets)
      let el: HTMLElement | null = target.parentElement
      while (el) {
        if (getComputedStyle(el).position === 'fixed') return
        el = el.parentElement
      }

      // Wait for keyboard animation to finish, then scroll into view
      setTimeout(() => {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 300)
    }

    document.addEventListener('focusin', handleFocusIn)
    return () => document.removeEventListener('focusin', handleFocusIn)
  }, [])
}
