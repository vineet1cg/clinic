import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

export function PermissionBoundary({ permissions, children }) {
  const { user } = useAuth();
  if (permissions.some((permission) => user?.permissions?.includes(permission))) return children;

  return (
    <section
      className="mx-auto max-w-xl rounded-2xl border border-clinic-border bg-clinic-surface p-8 text-center shadow-card"
      role="alert"
    >
      <ShieldAlert aria-hidden="true" className="mx-auto text-clinic-warning" size={32} />
      <h1 className="mt-4 font-display text-2xl font-semibold text-clinic-text">
        This page is restricted
      </h1>
      <p className="mt-3 text-clinic-muted">
        Your staff role does not have access to this page. Contact your clinic administrator if your
        responsibilities have changed.
      </p>
      <Link
        to="/app/dashboard"
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-clinic-action px-4 font-semibold text-white hover:bg-clinic-action-hover"
      >
        Return to dashboard
      </Link>
    </section>
  );
}
