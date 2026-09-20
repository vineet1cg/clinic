import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { ThemeContext } from './theme-context.js';
import {
  applyTheme,
  normalizeTheme,
  readThemePreference,
  subscribeToSystemTheme,
  systemPrefersDark,
  THEME_STORAGE_KEY,
} from '../utils/theme.js';

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readThemePreference);
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, systemPrefersDark, () => false);
  const resolvedTheme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useLayoutEffect(() => applyTheme(resolvedTheme), [resolvedTheme]);

  useEffect(() => {
    function syncPreference(event) {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        setPreference(readThemePreference());
      }
    }
    window.addEventListener('storage', syncPreference);
    return () => window.removeEventListener('storage', syncPreference);
  }, []);

  const setTheme = useCallback((value) => {
    const next = normalizeTheme(value);
    setPreference(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // The choice still works for this tab when storage is unavailable.
    }
  }, []);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setTheme }),
    [preference, resolvedTheme, setTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
