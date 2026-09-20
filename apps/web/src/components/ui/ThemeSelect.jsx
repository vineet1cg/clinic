import { Monitor, Moon, Sun } from 'lucide-react';
import { useId } from 'react';
import { useTheme } from '../../hooks/useTheme.js';

export function ThemeSelect() {
  const id = useId();
  const { preference, setTheme } = useTheme();
  const Icon = preference === 'system' ? Monitor : preference === 'dark' ? Moon : Sun;

  return (
    <div className="no-print relative shrink-0">
      <label htmlFor={id} className="sr-only">
        Color theme
      </label>
      <Icon
        aria-hidden="true"
        size={17}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-clinic-primary"
      />
      <select
        id={id}
        value={preference}
        onChange={(event) => setTheme(event.target.value)}
        className="min-h-11 max-w-32 cursor-pointer rounded-xl border border-clinic-border bg-clinic-surface pl-9 pr-2 text-sm font-semibold text-clinic-text hover:bg-clinic-subtle"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </div>
  );
}
