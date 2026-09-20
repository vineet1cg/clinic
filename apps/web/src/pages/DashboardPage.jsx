import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  IndianRupee,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PERMISSIONS } from '@clinicos/contracts';
import { ApiErrorNotice } from '../components/feedback/ApiErrorNotice.jsx';
import { EmptyState } from '../components/feedback/EmptyState.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { StatCard } from '../components/ui/StatCard.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { getDashboardSummary, listQueue } from '../services/clinic.service.js';
import { formatClinicDate } from '../utils/format.js';

const quickActions = [
  {
    label: 'Find patient',
    description: 'Name, mobile or patient ID',
    to: '/app/patients',
    icon: Search,
    permission: PERMISSIONS.PATIENT_VIEW,
  },
  {
    label: 'Register patient',
    description: 'Create a demographic record',
    to: '/app/patients/new',
    icon: UserPlus,
    permission: PERMISSIONS.PATIENT_CREATE,
  },
  {
    label: 'New appointment',
    description: 'Book a clinic time slot',
    to: '/app/appointments',
    icon: CalendarPlus,
    permission: PERMISSIONS.APPOINTMENT_CREATE,
  },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user.name.split(' ')[0];
  const canViewQueue = user.permissions.includes(PERMISSIONS.QUEUE_VIEW);
  const canRegisterPatient = user.permissions.includes(PERMISSIONS.PATIENT_CREATE);
  const availableQuickActions = quickActions.filter((action) =>
    user.permissions.includes(action.permission),
  );
  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardSummary,
    refetchInterval: 15_000,
  });
  const queueQuery = useQuery({
    queryKey: ['queue', 'today', 'dashboard'],
    queryFn: () => listQueue(),
    refetchInterval: 15_000,
    enabled: canViewQueue,
  });
  const metrics = dashboardQuery.data?.metrics;

  return (
    <>
      <PageHeader
        eyebrow={formatClinicDate()}
        title={`Good day, ${firstName}`}
        description="Today’s clinic flow and the information available to your role."
        actions={
          canRegisterPatient ? (
            <Link
              to="/app/patients/new"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-clinic-action px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-clinic-action-hover"
            >
              <UserPlus aria-hidden="true" size={18} />
              Register patient
            </Link>
          ) : null
        }
      />
      {dashboardQuery.isError ? (
        <div className="mb-5">
          <ApiErrorNotice error={dashboardQuery.error} />
        </div>
      ) : null}
      <section aria-labelledby="today-overview">
        <h2 id="today-overview" className="sr-only">
          Today&apos;s overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Patients today"
            value={metrics?.patientsToday ?? '—'}
            helper="Checked in or queued"
            icon={Users}
          />
          <StatCard
            label="Waiting now"
            value={metrics?.waiting ?? '—'}
            helper="Across all doctor stations"
            icon={Clock3}
            tone="warning"
          />
          <StatCard
            label="Completed"
            value={metrics?.completed ?? '—'}
            helper="Visits completed today"
            icon={CheckCircle2}
            tone="success"
          />
          <StatCard
            label="Revenue today"
            value={
              metrics?.revenue === null
                ? '—'
                : metrics
                  ? `₹${metrics.revenue.toLocaleString('en-IN')}`
                  : '—'
            }
            helper={metrics?.revenue === null ? 'Restricted by role' : 'Payments recorded'}
            icon={IndianRupee}
            tone="neutral"
          />
        </div>
      </section>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
        {canViewQueue ? (
          <section className="overflow-hidden rounded-2xl border border-clinic-border bg-clinic-surface shadow-card">
            <div className="flex items-center justify-between border-b border-clinic-border px-5 py-4 sm:px-6">
              <div>
                <h2 className="font-display text-lg font-semibold text-clinic-text">
                  Live patient queue
                </h2>
                <p className="mt-0.5 text-sm text-clinic-muted">
                  Refreshes automatically every 15 seconds
                </p>
              </div>
              <Link
                to="/app/queue"
                className="min-h-11 px-2 py-3 text-sm font-bold text-clinic-primary hover:text-clinic-primary-dark"
              >
                Open queue
              </Link>
            </div>
            {queueQuery.isError ? (
              <div className="p-5">
                <ApiErrorNotice error={queueQuery.error} />
              </div>
            ) : null}
            {queueQuery.isLoading ? (
              <p className="p-8 text-center text-sm text-clinic-muted">Loading queue…</p>
            ) : null}
            {!queueQuery.isLoading && !queueQuery.data?.length ? (
              <EmptyState
                compact
                icon={Activity}
                title="No patients waiting"
                description="Check in an appointment or add a walk-in to begin the queue."
              />
            ) : null}
            {queueQuery.data?.length ? (
              <ul className="divide-y divide-clinic-border">
                {queueQuery.data.slice(0, 6).map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-clinic-primary-soft font-bold text-clinic-primary-dark">
                        {entry.tokenNumber}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-clinic-text">
                          {entry.patientId?.fullName}
                        </p>
                        <p className="truncate text-xs text-clinic-muted">
                          Dr. {entry.doctorId?.name}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={entry.state} />
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : (
          <section className="rounded-2xl border border-clinic-border bg-clinic-surface p-6 shadow-card">
            <h2 className="font-display text-lg font-semibold text-clinic-text">
              Role-specific workspace
            </h2>
            <p className="mt-2 text-sm leading-6 text-clinic-muted">
              Queue details are hidden because they are not required for your role.
            </p>
          </section>
        )}
        <section className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card sm:p-6">
          <h2 className="font-display text-lg font-semibold text-clinic-text">Quick actions</h2>
          <p className="mt-1 text-sm text-clinic-muted">Tasks available to your role</p>
          <div className="mt-4 space-y-2">
            {availableQuickActions.length ? (
              availableQuickActions.map(({ label, description, to, icon: Icon }) => (
                <Link
                  key={label}
                  to={to}
                  className="flex min-h-16 items-center gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-clinic-border hover:bg-clinic-bg"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-clinic-primary-soft text-clinic-primary-dark">
                    <Icon aria-hidden="true" size={20} />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-clinic-text">{label}</span>
                    <span className="mt-0.5 block text-xs text-clinic-muted">{description}</span>
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-sm leading-6 text-clinic-muted">
                Use the navigation to open the tools assigned to you.
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
