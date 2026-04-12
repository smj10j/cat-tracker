import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { deriveDefaults, US_DEFAULTS, type UserPreferences } from '@shared/lib/preferences'

const STORAGE_KEY = 'cat-tracker-prefs'

interface PreferencesContextValue {
  prefs: UserPreferences
  overrides: Partial<UserPreferences>
  setPref: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void
  resetToLocale: () => void
  isOverridden: (key: keyof UserPreferences) => boolean
}

const PreferencesContext = createContext<PreferencesContextValue>({
  prefs: US_DEFAULTS,
  overrides: {},
  setPref: () => {},
  resetToLocale: () => {},
  isOverridden: () => false,
})

function readOverrides(): Partial<UserPreferences> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Partial<UserPreferences>
  } catch {
    return {}
  }
}

function writeOverrides(overrides: Partial<UserPreferences>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch { /* private browsing fallback — prefs work in-memory */ }
}

function getLocale(): string {
  try {
    return navigator.language || 'en-US'
  } catch {
    return 'en-US'
  }
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Partial<UserPreferences>>(readOverrides)

  const defaults = useMemo(() => deriveDefaults(getLocale()), [])

  const prefs = useMemo<UserPreferences>(() => ({
    ...defaults,
    ...overrides,
  }), [defaults, overrides])

  const setPref = useCallback(<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setOverrides(prev => {
      const next = { ...prev, [key]: value }
      writeOverrides(next)
      return next
    })
  }, [])

  const resetToLocale = useCallback(() => {
    setOverrides({})
    writeOverrides({})
  }, [])

  const isOverridden = useCallback((key: keyof UserPreferences) => {
    return key in overrides
  }, [overrides])

  return (
    <PreferencesContext.Provider value={{ prefs, overrides, setPref, resetToLocale, isOverridden }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export const usePreferences = () => useContext(PreferencesContext)

/** For tests: deterministic preferences without localStorage */
export function TestPreferencesProvider({ children, prefs }: { children: React.ReactNode; prefs?: Partial<UserPreferences> }) {
  const merged = { ...US_DEFAULTS, ...prefs }
  return (
    <PreferencesContext.Provider value={{
      prefs: merged,
      overrides: prefs ?? {},
      setPref: () => {},
      resetToLocale: () => {},
      isOverridden: () => false,
    }}>
      {children}
    </PreferencesContext.Provider>
  )
}
