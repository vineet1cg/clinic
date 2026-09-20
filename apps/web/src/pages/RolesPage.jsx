import { useQuery } from '@tanstack/react-query';
import { Check, ShieldCheck } from 'lucide-react';
import { ApiErrorNotice } from '../components/feedback/ApiErrorNotice.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { listRoles } from '../services/clinic.service.js';

export default function RolesPage() {
  const rolesQuery = useQuery({ queryKey: ['staff', 'roles'], queryFn: listRoles });
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Roles and permissions"
        description="ClinicOS uses granular permissions. Assign roles to staff; avoid shared or overly broad accounts."
      />
      {rolesQuery.isError ? <ApiErrorNotice error={rolesQuery.error} /> : null}
      {rolesQuery.isLoading ? (
        <p className="rounded-2xl border border-clinic-border bg-clinic-surface p-10 text-center text-clinic-muted">
          Loading permission matrix…
        </p>
      ) : null}
      {rolesQuery.data ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {rolesQuery.data.map(({ role, permissions }) => (
            <section
              key={role}
              className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-clinic-primary-soft text-clinic-primary">
                  <ShieldCheck aria-hidden="true" size={21} />
                </span>
                <div>
                  <h2 className="font-display text-base font-semibold text-clinic-text">
                    {role.replaceAll('_', ' ')}
                  </h2>
                  <p className="text-xs text-clinic-muted">{permissions.length} permissions</p>
                </div>
              </div>
              {permissions.length ? (
                <ul className="mt-4 space-y-2">
                  {permissions.map((permission) => (
                    <li
                      key={permission}
                      className="flex items-start gap-2 text-sm text-clinic-muted"
                    >
                      <Check
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-clinic-accent"
                        size={16}
                      />
                      <span>{permission}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-clinic-muted">No staff permissions.</p>
              )}
            </section>
          ))}
        </div>
      ) : null}
    </>
  );
}
