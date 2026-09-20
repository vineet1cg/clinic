import { ArrowUpRight } from 'lucide-react';

export function StatCard({ label, value, helper, icon: Icon, tone = 'primary' }) {
  const tones = {
    primary: 'bg-clinic-primary-soft text-clinic-primary-dark',
    success: 'bg-clinic-accent-soft text-clinic-accent',
    warning: 'bg-clinic-warning-soft text-clinic-warning',
    neutral: 'bg-clinic-subtle text-clinic-muted',
  };

  return (
    <article className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-clinic-muted">{label}</p>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-clinic-text">
            {value}
          </p>
        </div>
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <Icon aria-hidden="true" size={22} />
        </span>
      </div>
      {helper ? (
        <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-clinic-muted">
          <ArrowUpRight aria-hidden="true" size={14} />
          {helper}
        </p>
      ) : null}
    </article>
  );
}
