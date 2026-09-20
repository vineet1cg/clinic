import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, ShieldCheck, Stethoscope, Users } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { loginSchema } from '@clinicos/contracts';
import { useAuth } from '../hooks/useAuth.js';
import { getApiError } from '../services/http.js';
import { ThemeSelect } from '../components/ui/ThemeSelect.jsx';
import { ClinicBrand } from '../components/ui/ClinicBrand.jsx';

const advantages = [
  { icon: Users, label: 'Registration, payment, and doctor queue in one flow' },
  { icon: Stethoscope, label: 'Built for a validated OpenEMR connection' },
  { icon: ShieldCheck, label: 'Role-based access for every staff member' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading, isError, refresh, login, isLoggingIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (!isLoading && user) {
    return (
      <Navigate to={user.passwordResetRequired ? '/change-password' : '/app/dashboard'} replace />
    );
  }

  async function onSubmit(values) {
    setSubmitError(null);
    try {
      const signedInUser = await login(values);
      navigate(
        signedInUser.passwordResetRequired
          ? '/change-password'
          : location.state?.from || '/app/dashboard',
        { replace: true },
      );
    } catch (error) {
      setSubmitError(getApiError(error));
    }
  }

  return (
    <main className="grid min-h-dvh bg-clinic-bg lg:grid-cols-[minmax(360px,0.85fr)_1.15fr]">
      <section className="hidden bg-clinic-brand p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <ClinicBrand inverse />

        <div className="max-w-lg py-10">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-200">
            Maitri staff workspace
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight xl:text-5xl">
            Less time on screens. More time with patients.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-cyan-50/85">
            A focused workspace for reception, doctors, nurses, and billing—designed to connect with
            the clinic&apos;s OpenEMR record system after validation.
          </p>
          <ul className="mt-9 space-y-4">
            {advantages.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm font-medium text-cyan-50">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Icon aria-hidden="true" size={20} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs leading-5 text-cyan-100/80">
          Use an individual staff account. Never share passwords at the clinic desk.
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-end">
            <ThemeSelect />
          </div>
          <div className="mb-8 lg:hidden">
            <ClinicBrand />
          </div>

          <p className="text-sm font-semibold text-clinic-primary">Welcome back</p>
          <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-clinic-text">
            Sign in to your clinic
          </h2>
          <p className="mt-2 text-base leading-6 text-clinic-muted">
            Use the email and password provided by your clinic administrator.
          </p>

          {isError ? (
            <div
              className="mt-6 rounded-xl border border-clinic-danger/30 bg-clinic-danger-soft p-4"
              role="alert"
            >
              <p className="text-sm font-semibold text-clinic-danger">
                The ClinicOS server is unavailable.
              </p>
              <button
                type="button"
                onClick={() => refresh()}
                className="mt-2 min-h-11 text-sm font-bold text-clinic-danger underline underline-offset-4"
              >
                Check again
              </button>
            </div>
          ) : null}

          {submitError ? (
            <div
              className="mt-6 rounded-xl border border-clinic-danger/30 bg-clinic-danger-soft p-4"
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

          <form className="mt-7 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-clinic-text">
                Work email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className="min-h-12 w-full rounded-xl border border-clinic-border bg-clinic-surface px-4 text-base text-clinic-text placeholder:text-clinic-muted/70 hover:border-clinic-primary"
                placeholder="name@clinic.com"
                {...register('email')}
              />
              {errors.email ? (
                <p
                  id="email-error"
                  className="mt-1.5 text-sm font-medium text-clinic-danger"
                  role="alert"
                >
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-clinic-text"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className="min-h-12 w-full rounded-xl border border-clinic-border bg-clinic-surface px-4 pr-14 text-base text-clinic-text placeholder:text-clinic-muted/70 hover:border-clinic-primary"
                  placeholder="Enter your password"
                  {...register('password')}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-1.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-clinic-muted hover:bg-clinic-subtle hover:text-clinic-text"
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" size={20} />
                  ) : (
                    <Eye aria-hidden="true" size={20} />
                  )}
                </button>
              </div>
              {errors.password ? (
                <p
                  id="password-error"
                  className="mt-1.5 text-sm font-medium text-clinic-danger"
                  role="alert"
                >
                  {errors.password.message}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={isLoggingIn || isLoading}
              className="min-h-12 w-full rounded-xl bg-clinic-action px-5 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-clinic-action-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoggingIn ? 'Signing in…' : 'Sign in securely'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-clinic-muted">Powered by ClinicOS</p>
          <p className="mt-7 text-center text-xs leading-5 text-clinic-muted">
            Having trouble? Ask your clinic administrator to reset your account.
          </p>
        </div>
      </section>
    </main>
  );
}
