import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import type { ThemeFamily } from '@shared/lib/themeTokens';

export type ThemePreference = 'dark' | 'light' | 'system';

interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;
  family: ThemeFamily;
  setFamily: (f: ThemeFamily) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
  family: 'lamplight',
  setFamily: () => {},
});

const STORAGE_KEY = 'whisker-theme';
const FAMILY_STORAGE_KEY = 'themeFamily';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>('dark');
  const [family, setFamilyState] = useState<ThemeFamily>('lamplight');
  const [ready, setReady] = useState(false);
  const { setColorScheme } = useColorScheme();

  // Load persisted preferences on mount
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(FAMILY_STORAGE_KEY),
    ]).then(([storedTheme, storedFamily]) => {
      const pref = (storedTheme as ThemePreference) ?? 'dark';
      const fam = (storedFamily as ThemeFamily) ?? 'lamplight';
      setThemeState(pref);
      setFamilyState(fam);
      setColorScheme(pref);
      setReady(true);
    });
  }, []);

  function setTheme(t: ThemePreference) {
    setThemeState(t);
    setColorScheme(t);
    AsyncStorage.setItem(STORAGE_KEY, t);
  }

  function setFamily(f: ThemeFamily) {
    setFamilyState(f);
    AsyncStorage.setItem(FAMILY_STORAGE_KEY, f);
  }

  // Don't render children until we know the stored preference,
  // to avoid a flash of wrong theme.
  if (!ready) return null;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, family, setFamily }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
