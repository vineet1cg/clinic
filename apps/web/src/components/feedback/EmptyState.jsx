import { ClipboardList } from 'lucide-react';

export function EmptyState({
  icon: Icon = ClipboardList,
  title,
  description,
  action,
  compact = false,
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? 'px-4 py-8' : 'px-6 py-14'}`}
    >
      <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-clinic-subtle text-clinic-primary">
        <Icon aria-hidden="true" size={24} />
      </span>
      <h2 className="font-display text-lg font-semibold text-clinic-text">{title}</h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-clinic-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
