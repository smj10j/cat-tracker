import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { deriveDefaults, US_DEFAULTS, type UserPreferences } from '../../shared/lib/preferences';

const STORAGE_KEY = 'cat-tracker-prefs';

interface PreferencesContextValue {
  prefs: UserPreferences;
  overrides: Partial<UserPreferences>;
  setPref: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  resetToLocale: () => void;
  isOverridden: (key: keyof UserPreferences) => boolean;
}

const PreferencesContext = createContext<PreferencesContextValue>({
  prefs: US_DEFAULTS,
  overrides: {},
  setPref: () => {},
  resetToLocale: () => {},
  isOverridden: () => false,
});

function getDeviceLocale(): string {
  try {
    const locales = getLocales();
    return locales[0]?.languageTag ?? 'en-US';
  } catch {
    return 'en-US';
  }
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Partial<UserPreferences>>({});
  const [ready, setReady] = useState(false);

  const defaults = useMemo(() => deriveDefaults(getDeviceLocale()), []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setOverrides(JSON.parse(raw) as Partial<UserPreferences>);
        } catch { /* corrupt JSON — use defaults */ }
      }
      setReady(true);
    });
  }, []);

  const prefs = useMemo<UserPreferences>(() => ({
    ...defaults,
    ...overrides,
  }), [defaults, overrides]);

  const setPref = useCallback(<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setOverrides(prev => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetToLocale = useCallback(() => {
    setOverrides({});
    AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const isOverridden = useCallback((key: keyof UserPreferences) => {
    return key in overrides;
  }, [overrides]);

  if (!ready) return null;

  return (
    <PreferencesContext.Provider value={{ prefs, overrides, setPref, resetToLocale, isOverridden }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export const usePreferences = () => useContext(PreferencesContext);
