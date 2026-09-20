export const THEME_STORAGE_KEY = 'clinicos.theme';
export const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)';

export function normalizeTheme(value) {
  return ['light', 'dark', 'system'].includes(value) ? value : 'system';
}

export function readThemePreference() {
  try {
    return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function systemPrefersDark() {
  return window.matchMedia?.(SYSTEM_THEME_QUERY).matches ?? false;
}

export function subscribeToSystemTheme(listener) {
  const media = window.matchMedia?.(SYSTEM_THEME_QUERY);
  media?.addEventListener('change', listener);
  return () => media?.removeEventListener('change', listener);
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0c1821' : '#f4fbfc');
}
