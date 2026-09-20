import { HeartPulse } from 'lucide-react';

export function LoadingScreen({ label = 'Loading ClinicOS…' }) {
  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-clinic-bg px-6 text-clinic-text"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-clinic-border bg-clinic-surface px-5 py-4 shadow-card">
        <span className="flex size-11 items-center justify-center rounded-xl bg-clinic-action text-white">
          <HeartPulse aria-hidden="true" size={24} />
        </span>
        <div>
          <p className="font-display text-base font-semibold">ClinicOS</p>
          <p className="text-sm text-clinic-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}
