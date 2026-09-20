export const inputClassName =
  'min-h-12 w-full rounded-xl border border-clinic-border bg-clinic-surface px-3.5 py-2.5 text-base text-clinic-text placeholder:text-clinic-muted/70 hover:border-clinic-primary disabled:cursor-not-allowed disabled:bg-clinic-subtle disabled:opacity-70';

export const textareaClassName = `${inputClassName} min-h-28 resize-y`;

export function FormField({ id, label, error, helper, required = false, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-clinic-text">
        {label}
        {required ? (
          <span className="ml-1 text-clinic-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-sm font-medium text-clinic-danger" role="alert">
          {error}
        </p>
      ) : helper ? (
        <p className="mt-1.5 text-xs leading-5 text-clinic-muted">{helper}</p>
      ) : null}
    </div>
  );
}
