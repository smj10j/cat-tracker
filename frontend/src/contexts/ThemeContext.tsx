import { createContext, useContext, useEffect, useState } from 'react'
import type { ThemeFamily } from '@shared/lib/themeTokens'
import { THEME_FAMILIES } from '@shared/lib/themeTokens'

export type ThemeMode = 'dark' | 'light' | 'system'

interface ThemeContextValue {
  mode: ThemeMode
  setMode: (t: ThemeMode) => void
  family: ThemeFamily
  setFamily: (f: ThemeFamily) => void
  /** Backward-compat alias for mode. */
  theme: ThemeMode
  /** Backward-compat alias for setMode. */
  setTheme: (t: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  setMode: () => {},
  family: 'lamplight',
  setFamily: () => {},
  theme: 'dark',
  setTheme: () => {},
})

function resolvedMode(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

const MODE_KEY = 'cat-tracker-theme'
const FAMILY_KEY = 'cat-tracker-theme-family'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(MODE_KEY)
    return (stored as ThemeMode) ?? 'dark'
  })

  const [family, setFamilyState] = useState<ThemeFamily>(() => {
    const stored = localStorage.getItem(FAMILY_KEY)
    if (stored && (THEME_FAMILIES as readonly string[]).includes(stored)) {
      return stored as ThemeFamily
    }
    // Migration: first load → set lamplight
    localStorage.setItem(FAMILY_KEY, 'lamplight')
    return 'lamplight'
  })

  // Apply both axes to <html>
  useEffect(() => {
    const el = document.documentElement
    el.setAttribute('data-theme', resolvedMode(mode))
    el.setAttribute('data-theme-family', family)
  }, [mode, family])

  // Listen for OS theme changes when mode is 'system'
  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      document.documentElement.setAttribute('data-theme', resolvedMode('system'))
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode])

  function setMode(t: ThemeMode) {
    localStorage.setItem(MODE_KEY, t)
    setModeState(t)
  }

  function setFamily(f: ThemeFamily) {
    localStorage.setItem(FAMILY_KEY, f)
    setFamilyState(f)
  }

  return (
    <ThemeContext.Provider
      value={{
        mode,
        setMode,
        family,
        setFamily,
        // Backward compat
        theme: mode,
        setTheme: setMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
