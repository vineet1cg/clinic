export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-clinic-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-clinic-text sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-clinic-muted sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="no-print flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
