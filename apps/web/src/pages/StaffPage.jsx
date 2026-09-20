import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { PERMISSIONS, staffCreateSchema, USER_ROLES } from '@clinicos/contracts';
import { ApiErrorNotice } from '../components/feedback/ApiErrorNotice.jsx';
import { EmptyState } from '../components/feedback/EmptyState.jsx';
import { FormField, inputClassName } from '../components/forms/FormField.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { createStaff, listStaff, updateStaff } from '../services/clinic.service.js';

const roleLabels = Object.fromEntries(
  Object.values(USER_ROLES).map((role) => [role, role.replaceAll('_', ' ')]),
);

function DoctorFeeEditor({ member, canEdit, onSave, saving }) {
  const [fee, setFee] = useState(member.consultationFee ?? '');
  const [error, setError] = useState('');

  function save() {
    const parsed = Number(fee);
    if (
      fee !== '' &&
      (!Number.isFinite(parsed) ||
        parsed <= 0 ||
        Math.abs(Math.round(parsed * 100) - parsed * 100) > 1e-7)
    ) {
      setError('Enter a positive fee with no more than two decimal places.');
      return;
    }
    setError('');
    onSave({ id: member.id, input: { consultationFee: fee === '' ? null : parsed } });
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="text-xs font-semibold text-clinic-muted">
        Doctor fee override ₹
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={fee}
          onChange={(event) => setFee(event.target.value)}
          disabled={!canEdit || saving}
          placeholder="Clinic default"
          className="mt-1 block w-40 rounded-lg border border-clinic-border px-3 py-2 text-sm text-clinic-text disabled:bg-clinic-bg"
        />
      </label>
      {canEdit ? (
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="min-h-10 rounded-lg border border-clinic-primary px-3 text-xs font-bold text-clinic-primary disabled:opacity-50"
        >
          Save fee
        </button>
      ) : null}
      {error ? (
        <p className="w-full text-xs text-clinic-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function StaffPage() {
  const { user } = useAuth();
  const canUpdate = user.permissions.includes(PERMISSIONS.STAFF_UPDATE);
  const queryClient = useQueryClient();
  const staffQuery = useQuery({ queryKey: ['staff'], queryFn: listStaff });
  const form = useForm({
    resolver: zodResolver(staffCreateSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: undefined,
      password: '',
      roles: [USER_ROLES.RECEPTIONIST],
    },
  });
  const createMutation = useMutation({
    mutationFn: createStaff,
    onSuccess: () => {
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['scheduling-context'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }) => updateStaff(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduling-context'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Staff"
        description="Every staff member receives an individual account with explicit roles and a forced password change."
        actions={
          <Link
            to="/app/roles"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-clinic-border bg-clinic-surface px-4 text-sm font-bold text-clinic-text hover:bg-clinic-subtle"
          >
            <ShieldCheck aria-hidden="true" size={18} />
            Review permissions
          </Link>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-clinic-primary-soft text-clinic-primary">
              <UserPlus aria-hidden="true" size={21} />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-clinic-text">
                Add staff member
              </h2>
              <p className="text-sm text-clinic-muted">Create a secure first login.</p>
            </div>
          </div>
          <form
            className="mt-5 space-y-4"
            onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
          >
            <FormField
              id="staffName"
              label="Full name"
              required
              error={form.formState.errors.name?.message}
            >
              <input
                id="staffName"
                className={inputClassName}
                autoComplete="name"
                {...form.register('name')}
              />
            </FormField>
            <FormField
              id="staffEmail"
              label="Work email"
              required
              error={form.formState.errors.email?.message}
            >
              <input
                id="staffEmail"
                type="email"
                className={inputClassName}
                autoComplete="off"
                {...form.register('email')}
              />
            </FormField>
            <FormField id="staffPhone" label="Mobile" error={form.formState.errors.phone?.message}>
              <input
                id="staffPhone"
                type="tel"
                className={inputClassName}
                {...form.register('phone', {
                  setValueAs: (value) => (value === '' ? undefined : value),
                })}
              />
            </FormField>
            <FormField
              id="staffRole"
              label="Primary role"
              required
              error={form.formState.errors.roles?.message}
            >
              <select id="staffRole" className={inputClassName} {...form.register('roles.0')}>
                {Object.values(USER_ROLES)
                  .filter((role) => role !== USER_ROLES.PATIENT)
                  .map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
              </select>
            </FormField>
            <FormField
              id="staffPassword"
              label="Temporary password"
              required
              error={form.formState.errors.password?.message}
              helper="At least 12 characters. Share it privately."
            >
              <input
                id="staffPassword"
                type="password"
                className={inputClassName}
                autoComplete="new-password"
                {...form.register('password')}
              />
            </FormField>
            {createMutation.isError ? <ApiErrorNotice error={createMutation.error} /> : null}
            {createMutation.isSuccess ? (
              <p className="rounded-xl bg-clinic-accent-soft p-3 text-sm font-semibold text-clinic-accent">
                Staff account created.
              </p>
            ) : null}
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="min-h-12 w-full rounded-xl bg-clinic-action px-4 font-bold text-white hover:bg-clinic-action-hover disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating account…' : 'Create staff account'}
            </button>
          </form>
        </section>
        <section
          className="overflow-hidden rounded-2xl border border-clinic-border bg-clinic-surface shadow-card"
          aria-labelledby="staff-directory"
        >
          <div className="border-b border-clinic-border px-5 py-4 sm:px-6">
            <h2
              id="staff-directory"
              className="font-display text-lg font-semibold text-clinic-text"
            >
              Staff directory
            </h2>
            <p className="mt-1 text-sm text-clinic-muted">
              {staffQuery.data?.length || 0} individual accounts
            </p>
          </div>
          {staffQuery.isError ? (
            <div className="p-5">
              <ApiErrorNotice error={staffQuery.error} />
            </div>
          ) : null}
          {updateMutation.isError ? (
            <div className="p-5">
              <ApiErrorNotice error={updateMutation.error} />
            </div>
          ) : null}
          {staffQuery.isLoading ? (
            <p className="p-10 text-center text-sm text-clinic-muted">Loading staff…</p>
          ) : null}
          {!staffQuery.isLoading && !staffQuery.data?.length ? (
            <EmptyState
              icon={Users}
              title="No staff accounts"
              description="Create the first staff account using the form."
            />
          ) : null}
          {staffQuery.data?.length ? (
            <ul className="divide-y divide-clinic-border">
              {staffQuery.data.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-clinic-text">{member.name}</p>
                      <StatusBadge status={member.status} />
                    </div>
                    <p className="mt-1 text-sm text-clinic-muted">{member.email}</p>
                    <p className="mt-1 text-xs font-semibold text-clinic-primary">
                      {member.roles.map((role) => roleLabels[role]).join(', ')}
                    </p>
                    {member.roles.some((role) =>
                      [USER_ROLES.DOCTOR, USER_ROLES.SUPER_ADMIN].includes(role),
                    ) ? (
                      <DoctorFeeEditor
                        key={`${member.id}:${member.consultationFee}`}
                        member={member}
                        canEdit={
                          canUpdate &&
                          (!member.roles.includes(USER_ROLES.SUPER_ADMIN) ||
                            user.roles.includes(USER_ROLES.SUPER_ADMIN))
                        }
                        onSave={updateMutation.mutate}
                        saving={updateMutation.isPending}
                      />
                    ) : null}
                  </div>
                  {canUpdate ? (
                    <button
                      type="button"
                      onClick={() =>
                        updateMutation.mutate({
                          id: member.id,
                          input: { status: member.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE' },
                        })
                      }
                      disabled={
                        updateMutation.isPending || member.roles.includes(USER_ROLES.SUPER_ADMIN)
                      }
                      className="min-h-11 rounded-xl border border-clinic-border px-3 text-sm font-bold text-clinic-muted hover:bg-clinic-subtle disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {member.status === 'INACTIVE' ? 'Reactivate' : 'Deactivate'}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </>
  );
}
