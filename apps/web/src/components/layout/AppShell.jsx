import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';

export function AppShell() {
  const { user } = useAuth();
  const location = useLocation();
  const mainRef = useRef(null);
  const [navigationOpen, setNavigationOpen] = useState(false);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  useEffect(() => {
    if (!navigationOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setNavigationOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigationOpen]);

  return (
    <div className="min-h-dvh bg-clinic-bg text-clinic-text">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-50 -translate-y-20 rounded-lg bg-clinic-action px-4 py-2 font-semibold text-white focus:translate-y-0"
      >
        Skip to main content
      </a>
      <Sidebar open={navigationOpen} onClose={() => setNavigationOpen(false)} user={user} />
      <div className="app-content">
        <Topbar navigationOpen={navigationOpen} onOpenNavigation={() => setNavigationOpen(true)} />
        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className="mx-auto w-full max-w-[1600px] px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
