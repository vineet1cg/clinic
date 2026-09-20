import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Eye, EyeOff, KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { changePasswordSchema } from '@clinicos/contracts';
import { useAuth } from '../hooks/useAuth.js';
import { ThemeSelect } from '../components/ui/ThemeSelect.jsx';
import { ClinicBrand } from '../components/ui/ClinicBrand.jsx';
import { getApiError } from '../services/http.js';

const requirements = [
  'At least 12 characters',
  'One uppercase and one lowercase letter',
  'One number and one symbol',
  'Different from your temporary password',
];

function PasswordInput({ id, label, autoComplete, error, register }) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-clinic-text">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="min-h-12 w-full rounded-xl border border-clinic-border bg-clinic-surface px-4 pr-14 text-base text-clinic-text hover:border-clinic-primary"
          {...register(id)}
        />
        <button
          type="button"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          onClick={() => setVisible((current) => !current)}
          className="absolute right-1.5 top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-clinic-muted transition-colors hover:bg-clinic-subtle hover:text-clinic-text"
        >
          {visible ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
        </button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-sm font-medium text-clinic-danger">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, changePassword, isChangingPassword, logout, isLoggingOut } = useAuth();
  const [submitError, setSubmitError] = useState(null);
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  async function onSubmit(values) {
    setSubmitError(null);
    try {
      await changePassword(values);
      navigate('/app/dashboard', { replace: true });
    } catch (error) {
      const apiError = getApiError(error);
      setSubmitError(apiError);
      if (apiError.code === 'CURRENT_PASSWORD_INCORRECT') setFocus('currentPassword');
    }
  }

  async function handleSignOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-clinic-bg px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-2xl justify-end">
        <ThemeSelect />
      </div>
      <section className="w-full max-w-2xl overflow-hidden rounded-2xl border border-clinic-border bg-clinic-surface shadow-card">
        <div className="border-b border-clinic-border bg-clinic-brand px-6 py-6 text-white sm:px-8">
          <ClinicBrand inverse subtitle="Secure your staff account" />
        </div>

        <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[1fr_0.8fr]">
          <div>
            <span className="flex size-11 items-center justify-center rounded-xl bg-clinic-primary-soft text-clinic-primary">
              <KeyRound aria-hidden="true" size={22} />
            </span>
            <h1 className="mt-4 font-display text-2xl font-semibold text-clinic-text">
              Change your temporary password
            </h1>
            <p className="mt-2 text-sm leading-6 text-clinic-muted">
              Hi {user.name}. You must choose a private password before accessing clinic data.
            </p>

            {submitError ? (
              <div
                className="mt-5 rounded-xl border border-clinic-danger/30 bg-clinic-danger-soft p-4"
                role="alert"
              >
                <p className="text-sm font-semibold text-clinic-danger">{submitError.message}</p>
                {submitError.requestId ? (
                  <p className="mt-1 text-xs text-clinic-danger">
                    Reference: {submitError.requestId}
                  </p>
                ) : null}
              </div>
            ) : null}

            <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
              <PasswordInput
                id="currentPassword"
                label="Current password"
                autoComplete="current-password"
                error={errors.currentPassword}
                register={register}
              />
              <PasswordInput
                id="newPassword"
                label="New password"
                autoComplete="new-password"
                error={errors.newPassword}
                register={register}
              />
              <PasswordInput
                id="confirmPassword"
                label="Confirm new password"
                autoComplete="new-password"
                error={errors.confirmPassword}
                register={register}
              />
              <button
                type="submit"
                disabled={isChangingPassword}
                className="min-h-12 w-full cursor-pointer rounded-xl bg-clinic-action px-5 font-bold text-white transition-colors hover:bg-clinic-action-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isChangingPassword ? 'Securing account…' : 'Save password and continue'}
              </button>
            </form>
          </div>

          <aside className="rounded-2xl bg-clinic-subtle p-5">
            <div className="flex items-center gap-2 text-clinic-accent">
              <ShieldCheck aria-hidden="true" size={21} />
              <h2 className="font-display font-semibold text-clinic-text">Password requirements</h2>
            </div>
            <ul className="mt-4 space-y-3">
              {requirements.map((requirement) => (
                <li key={requirement} className="flex gap-2 text-sm leading-5 text-clinic-muted">
                  <Check
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-clinic-accent"
                    size={17}
                  />
                  {requirement}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs leading-5 text-clinic-muted">
              Clinic administrators cannot view your password. Never share it at the reception desk.
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isLoggingOut}
              className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-clinic-border bg-clinic-surface px-4 text-sm font-bold text-clinic-text transition-colors hover:border-clinic-danger hover:text-clinic-danger disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut aria-hidden="true" size={18} />
              Sign out
            </button>
          </aside>
        </div>
      </section>
    </main>
  );
}
