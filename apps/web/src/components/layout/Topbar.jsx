import { LogOut, Menu, Search, Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useNetworkStatus } from '../../hooks/useNetworkStatus.js';
import { initials } from '../../utils/format.js';
import { ThemeSelect } from '../ui/ThemeSelect.jsx';

export function Topbar({ onOpenNavigation }) {
  const navigate = useNavigate();
  const { user, logout, isLoggingOut } = useAuth();
  const online = useNetworkStatus();
  const [query, setQuery] = useState('');

  function handleSearch(event) {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/app/patients?query=${encodeURIComponent(value)}` : '/app/patients');
  }

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="no-print sticky top-0 z-20 border-b border-clinic-border bg-clinic-surface/95 backdrop-blur-sm">
      <div className="flex min-h-20 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          aria-label="Open navigation"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-clinic-text hover:bg-clinic-subtle lg:hidden"
          onClick={onOpenNavigation}
        >
          <Menu aria-hidden="true" size={23} />
        </button>

        <form className="relative min-w-0 flex-1 lg:max-w-xl" role="search" onSubmit={handleSearch}>
          <label className="sr-only" htmlFor="global-patient-search">
            Search patients by name, mobile, or ID
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-clinic-muted"
            size={19}
          />
          <input
            id="global-patient-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-clinic-border bg-clinic-bg py-2.5 pl-11 pr-4 text-base text-clinic-text placeholder:text-clinic-muted/80 hover:border-clinic-primary sm:text-sm"
            placeholder="Search patient name, mobile or ID"
            autoComplete="off"
          />
        </form>

        <ThemeSelect />

        <div
          role="status"
          className={`hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold sm:flex ${
            online
              ? 'bg-clinic-accent-soft text-clinic-accent'
              : 'bg-clinic-warning-soft text-clinic-warning'
          }`}
        >
          {online ? (
            <Wifi aria-hidden="true" size={15} />
          ) : (
            <WifiOff aria-hidden="true" size={15} />
          )}
          {online ? 'Browser online' : 'Browser offline'}
        </div>

        <div className="hidden min-w-0 items-center gap-3 border-l border-clinic-border pl-4 md:flex">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-clinic-action text-sm font-bold text-white">
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <p className="max-w-40 truncate text-sm font-semibold text-clinic-text">{user.name}</p>
            <p className="max-w-40 truncate text-xs text-clinic-muted">
              {user.roles[0].replaceAll('_', ' ').toLowerCase()}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Sign out"
          title="Sign out"
          disabled={isLoggingOut}
          onClick={handleLogout}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-clinic-muted transition-colors hover:bg-clinic-danger-soft hover:text-clinic-danger disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LogOut aria-hidden="true" size={20} />
        </button>
      </div>
    </header>
  );
}
