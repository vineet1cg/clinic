import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from './ThemeProvider.jsx';
import { ThemeSelect } from '../components/ui/ThemeSelect.jsx';
import { THEME_STORAGE_KEY } from '../utils/theme.js';

let systemDark;
let listeners;

function renderTheme() {
  return render(
    <ThemeProvider>
      <ThemeSelect />
    </ThemeProvider>,
  );
}

function changeSystemTheme(dark) {
  act(() => {
    systemDark = dark;
    for (const listener of listeners) listener({ matches: dark });
  });
}

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  systemDark = false;
  listeners = new Set();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return systemDark;
      },
      addEventListener: (_event, listener) => listeners.add(listener),
      removeEventListener: (_event, listener) => listeners.delete(listener),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('global theme preference', () => {
  it('follows system changes until explicitly overridden, and restores following on System', () => {
    renderTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
    changeSystemTheme(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent.change(screen.getByRole('combobox', { name: 'Color theme' }), {
      target: { value: 'light' },
    });
    changeSystemTheme(false);
    changeSystemTheme(true);
    expect(document.documentElement.dataset.theme).toBe('light');
    fireEvent.change(screen.getByRole('combobox', { name: 'Color theme' }), {
      target: { value: 'system' },
    });
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('persists a selection across remounts and synchronizes another tab or storage clearing', () => {
    const view = renderTheme();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dark' } });
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    view.unmount();
    renderTheme();
    expect(screen.getByRole('combobox')).toHaveValue('dark');
    act(() => {
      window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
      window.dispatchEvent(
        new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'light' }),
      );
    });
    expect(document.documentElement.dataset.theme).toBe('light');
    changeSystemTheme(true);
    act(() => {
      window.localStorage.clear();
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
    });
    expect(screen.getByRole('combobox')).toHaveValue('system');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('still switches theme when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage denied');
    });
    renderTheme();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dark' } });
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('uses system preference for an invalid stored value', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'invalid');
    systemDark = true;
    renderTheme();
    expect(screen.getByRole('combobox')).toHaveValue('system');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('applies the stored theme before React starts and stays consistent after mounting', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const source = readFileSync(new NodeURL('../../public/theme-init.js', import.meta.url), 'utf8');
    const runBootstrap = new Function('window', 'document', 'localStorage', source);
    runBootstrap(window, document, window.localStorage);
    expect(document.documentElement.dataset.theme).toBe('dark');
    renderTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
