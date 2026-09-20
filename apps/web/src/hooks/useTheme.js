import { useContext } from 'react';
import { ThemeContext } from '../contexts/theme-context.js';

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside ThemeProvider');
  return theme;
}
