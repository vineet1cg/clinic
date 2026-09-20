import { AlertCircle } from 'lucide-react';
import { getApiError } from '../../services/http.js';

export function ApiErrorNotice({ error, title }) {
  if (!error) return null;
  const apiError = getApiError(error);
  return (
    <div
      className="rounded-xl border border-clinic-danger/30 bg-clinic-danger-soft p-4"
      role="alert"
    >
      <div className="flex gap-3">
        <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0 text-clinic-danger" size={20} />
        <div>
          <p className="text-sm font-bold text-clinic-danger">{title || apiError.message}</p>
          {title ? <p className="mt-1 text-sm text-clinic-danger">{apiError.message}</p> : null}
          {apiError.requestId ? (
            <p className="mt-1 text-xs text-clinic-danger">Reference: {apiError.requestId}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
