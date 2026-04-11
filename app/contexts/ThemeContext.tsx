import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';

export type ThemePreference = 'dark' | 'light' | 'system';

interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
});

const STORAGE_KEY = 'whisker-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>('dark');
  const [ready, setReady] = useState(false);
  const { setColorScheme } = useColorScheme();

  // Load persisted preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      const pref = (stored as ThemePreference) ?? 'dark';
      setThemeState(pref);
      setColorScheme(pref);
      setReady(true);
    });
  }, []);

  function setTheme(t: ThemePreference) {
    setThemeState(t);
    setColorScheme(t);
    AsyncStorage.setItem(STORAGE_KEY, t);
  }

  // Don't render children until we know the stored preference,
  // to avoid a flash of wrong theme.
  if (!ready) return null;

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
