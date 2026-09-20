import { ArrowLeft, FileQuestion } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ThemeSelect } from '../components/ui/ThemeSelect.jsx';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-clinic-bg p-6">
      <section className="w-full max-w-lg rounded-2xl border border-clinic-border bg-clinic-surface p-8 text-center shadow-card">
        <div className="mb-4 flex justify-end">
          <ThemeSelect />
        </div>
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-clinic-subtle text-clinic-primary">
          <FileQuestion aria-hidden="true" size={24} />
        </span>
        <p className="mt-5 text-sm font-bold uppercase tracking-wider text-clinic-primary">
          Page not found
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-clinic-text">
          This screen is unavailable
        </h1>
        <p className="mt-2 text-base leading-7 text-clinic-muted">
          The address may be incorrect, or your role may not have access to this clinic screen.
        </p>
        <Link
          to="/app/dashboard"
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-clinic-action px-5 py-2.5 font-bold text-white hover:bg-clinic-action-hover"
        >
          <ArrowLeft aria-hidden="true" size={18} />
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}
