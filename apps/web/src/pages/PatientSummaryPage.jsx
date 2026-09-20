import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, CheckCircle2, CreditCard, History, Phone, UserRound } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { PERMISSIONS, calculateAge } from '@clinicos/contracts';
import { useClinicClock } from '../hooks/useClinicClock.js';
import { ApiErrorNotice } from '../components/feedback/ApiErrorNotice.jsx';
import { EmptyState } from '../components/feedback/EmptyState.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { getPatient } from '../services/clinic.service.js';
import { useAuth } from '../hooks/useAuth.js';

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-clinic-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-clinic-text">{value || 'Not recorded'}</dd>
    </div>
  );
}

export default function PatientSummaryPage() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const clock = useClinicClock();
  const patientQuery = useQuery({ queryKey: ['patient', id], queryFn: () => getPatient(id) });

  if (patientQuery.isLoading)
    return (
      <div className="rounded-2xl border border-clinic-border bg-clinic-surface p-10 text-center text-clinic-muted">
        Loading patient record…
      </div>
    );
  if (patientQuery.isError) return <ApiErrorNotice error={patientQuery.error} />;

  const { patient, appointments, encounters, invoices, access } = patientQuery.data;
  const canCreateAppointment = user.permissions.includes(PERMISSIONS.APPOINTMENT_CREATE);
  return (
    <>
      <PageHeader
        eyebrow={`Patient ${patient.patientNumber}`}
        title={patient.fullName}
        description={`${patient.mobile} · ${patient.gender.toLowerCase()} · ${(patient.dateOfBirth ? formatClinicDate(patient.dateOfBirth) : null) || `${patient.age} years`}`}
        actions={
          canCreateAppointment ? (
            <>
              <Link
                to={`/app/appointments?patientId=${patient.id}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-clinic-action px-4 text-sm font-bold text-white hover:bg-clinic-action-hover"
              >
                <CalendarPlus aria-hidden="true" size={18} />
                Book visit
              </Link>
              <Link
                to={`/app/appointments?mode=walk-in&patientId=${patient.id}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-clinic-border bg-clinic-surface px-4 text-sm font-bold text-clinic-text hover:bg-clinic-subtle"
              >
                Add walk-in
              </Link>
            </>
          ) : null
        }
      />

      {location.state?.created ? (
        <div
          className="mb-5 flex items-center gap-3 rounded-xl border border-clinic-accent/30 bg-clinic-accent-soft p-4 text-sm font-semibold text-clinic-accent"
          role="status"
        >
          <CheckCircle2 aria-hidden="true" size={20} />
          Patient registered successfully.
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <section
            className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card sm:p-6"
            aria-labelledby="demographics-heading"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-clinic-primary-soft text-clinic-primary">
                <UserRound aria-hidden="true" size={22} />
              </span>
              <div>
                <h2
                  id="demographics-heading"
                  className="font-display text-lg font-semibold text-clinic-text"
                >
                  Demographics
                </h2>
                <p className="text-sm text-clinic-muted">Identity and contact details</p>
              </div>
            </div>
            <dl className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Mobile" value={patient.mobile} />
              <Detail label="Email" value={patient.email} />
              <Detail
                label="Date of birth"
                value={patient.dateOfBirth ? formatClinicDate(patient.dateOfBirth) : null}
              />
              <Detail label="Blood group" value={patient.bloodGroup} />
              <Detail
                label="Age"
                value={`${(patient.dateOfBirth ? calculateAge(patient.dateOfBirth, clock.date) : patient.age) ?? 'Unknown'} years`}
              />
              <Detail label="Emergency contact" value={patient.emergencyContact} />
              <Detail label="Preferred language" value={patient.preferredLanguage?.toUpperCase()} />
              <div className="sm:col-span-2 lg:col-span-3">
                <Detail
                  label="Address"
                  value={[patient.address, patient.city, patient.state, patient.pinCode]
                    .filter(Boolean)
                    .join(', ')}
                />
              </div>
            </dl>
          </section>

          <section
            className="overflow-hidden rounded-2xl border border-clinic-border bg-clinic-surface shadow-card"
            aria-labelledby="visits-heading"
          >
            <div className="border-b border-clinic-border px-5 py-4 sm:px-6">
              <h2
                id="visits-heading"
                className="font-display text-lg font-semibold text-clinic-text"
              >
                Visit history
              </h2>
              <p className="mt-1 text-sm text-clinic-muted">
                {access.appointments || access.encounters
                  ? 'History available to your role'
                  : 'Clinical and appointment history is restricted for your role'}
              </p>
            </div>
            {!appointments.length && !encounters.length ? (
              <EmptyState
                compact
                icon={History}
                title={
                  access.appointments || access.encounters
                    ? 'No visits recorded'
                    : 'Visit history restricted'
                }
                description={
                  access.appointments || access.encounters
                    ? 'Book an appointment or add a walk-in to begin this patient’s clinic history.'
                    : 'Your role can view patient demographics but not appointment or clinical history.'
                }
              />
            ) : (
              <div className="divide-y divide-clinic-border">
                {encounters.map((encounter) => (
                  <div
                    key={encounter.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"
                  >
                    <div>
                      <p className="font-bold text-clinic-text">
                        Consultation with {encounter.doctorId?.name || 'doctor'}
                      </p>
                      <p className="mt-1 text-sm text-clinic-muted">
                        {formatClinicDate(encounter.createdAt)} ·{' '}
                        {encounter.diagnoses?.join(', ') || 'No diagnosis recorded'}
                      </p>
                    </div>
                    <StatusBadge status={encounter.status} />
                  </div>
                ))}
                {appointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"
                  >
                    <div>
                      <p className="font-bold text-clinic-text">
                        {appointment.visitType.replaceAll('_', ' ')}
                      </p>
                      <p className="mt-1 text-sm text-clinic-muted">
                        {formatClinicDate(appointment.date)} at {appointment.time} ·{' '}
                        {appointment.doctorId?.name}
                      </p>
                    </div>
                    <StatusBadge status={appointment.status} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card">
            <h2 className="font-display text-lg font-semibold text-clinic-text">Record status</h2>
            <dl className="mt-4 space-y-4">
              <Detail
                label="ClinicOS source"
                value={patient.source === 'OPENEMR' ? 'OpenEMR synced' : 'Local clinic record'}
              />
              <Detail label="Created" value={formatClinicDateTime(patient.createdAt)} />
            </dl>
          </section>
          {access.billing ? (
            <section className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card">
              <div className="flex items-center gap-2">
                <CreditCard aria-hidden="true" className="text-clinic-primary" size={20} />
                <h2 className="font-display text-lg font-semibold text-clinic-text">Billing</h2>
              </div>
              <p className="mt-2 text-sm text-clinic-muted">
                {invoices.length} invoice{invoices.length === 1 ? '' : 's'} · ₹
                {invoices
                  .reduce((total, invoice) => total + invoice.balance, 0)
                  .toLocaleString('en-IN')}{' '}
                outstanding
              </p>
              <Link
                to={`/app/billing?patientId=${patient.id}`}
                className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-clinic-primary hover:text-clinic-primary-dark"
              >
                Open billing
              </Link>
            </section>
          ) : null}
          <a
            href={`tel:${patient.mobile}`}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-clinic-border bg-clinic-surface px-4 text-sm font-bold text-clinic-text hover:bg-clinic-subtle"
          >
            <Phone aria-hidden="true" size={18} />
            Call patient
          </a>
        </aside>
      </div>
    </>
  );
}
import { formatClinicDate, formatClinicDateTime } from '../utils/format.js';
