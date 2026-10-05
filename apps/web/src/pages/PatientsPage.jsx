import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Search, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiErrorNotice } from '../components/feedback/ApiErrorNotice.jsx';
import { EmptyState } from '../components/feedback/EmptyState.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { searchPatients } from '../services/clinic.service.js';
import { formatClinicDate } from '../utils/format.js';

export default function PatientsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeQuery = searchParams.get('query') || '';
  const [query, setQuery] = useState(activeQuery);
  const patientsQuery = useQuery({
    queryKey: ['patients', 'search', activeQuery],
    queryFn: () => searchPatients(activeQuery),
    enabled: activeQuery.length >= 2,
  });

  function handleSubmit(event) {
    event.preventDefault();
    const value = query.trim();
    setSearchParams(value.length >= 2 ? { query: value } : {});
  }

  return (
    <>
      <PageHeader
        eyebrow="Front desk"
        title="Patients"
        description="Search by mobile first, then patient ID, name, or date of birth. Confirm two identifiers before opening or editing a record."
        actions={
          <Link
            to="/app/patients/new"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-clinic-action px-4 py-2.5 text-sm font-bold text-white hover:bg-clinic-action-hover"
          >
            <UserPlus aria-hidden="true" size={18} />
            Register patient
          </Link>
        }
      />

      <section className="overflow-hidden rounded-2xl border border-clinic-border bg-clinic-surface shadow-card">
        <form
          className="border-b border-clinic-border p-4 sm:p-6"
          role="search"
          onSubmit={handleSubmit}
        >
          <label
            htmlFor="patient-search"
            className="mb-2 block text-sm font-semibold text-clinic-text"
          >
            Find a patient
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                aria-hidden="true"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-clinic-muted"
                size={19}
              />
              <input
                id="patient-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-clinic-border bg-clinic-bg py-2.5 pl-11 pr-4 text-base text-clinic-text placeholder:text-clinic-muted/75"
                placeholder="Mobile number, patient ID, name or YYYY-MM-DD"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              disabled={query.trim().length < 2}
              className="min-h-12 rounded-xl bg-clinic-action px-6 py-2.5 font-bold text-white hover:bg-clinic-action-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Search patients
            </button>
          </div>
          <p className="mt-2 text-xs leading-5 text-clinic-muted">
            Search before every registration to reduce duplicate patient records.
          </p>
        </form>

        {patientsQuery.isError ? (
          <div className="p-5">
            <ApiErrorNotice error={patientsQuery.error} />
          </div>
        ) : null}
        {patientsQuery.isFetching ? (
          <div className="p-8 text-center text-sm font-medium text-clinic-muted" role="status">
            Searching patient records…
          </div>
        ) : null}
        {!activeQuery ? (
          <EmptyState
            icon={Users}
            title="Search before registering"
            description="Start with the patient’s mobile number. You can also search by patient number, name, or date of birth."
          />
        ) : null}
        {activeQuery && !patientsQuery.isFetching && patientsQuery.data?.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching patients"
            description={`No patient matched “${activeQuery}”. Check the spelling or register a new patient.`}
            action={
              <Link
                to="/app/patients/new"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-clinic-action px-4 text-sm font-bold text-white"
              >
                <UserPlus aria-hidden="true" size={18} />
                Register patient
              </Link>
            }
          />
        ) : null}
        {patientsQuery.data?.length ? (
          <div>
            <div className="border-b border-clinic-border px-5 py-3 text-sm text-clinic-muted">
              {patientsQuery.data.length} {patientsQuery.data.length === 1 ? 'patient' : 'patients'}{' '}
              found
            </div>
            <ul className="divide-y divide-clinic-border">
              {patientsQuery.data.map((patient) => (
                <li key={patient.id}>
                  <Link
                    to={`/app/patients/${patient.id}`}
                    className="flex min-h-20 items-center justify-between gap-4 px-5 py-4 hover:bg-clinic-bg sm:px-6"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-bold text-clinic-text">{patient.fullName}</p>
                        <span className="rounded-full bg-clinic-subtle px-2 py-1 text-xs font-bold text-clinic-primary-dark">
                          {patient.patientNumber}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-clinic-muted">
                        {patient.mobile} · {patient.gender.toLowerCase()} ·{' '}
                        {(patient.dateOfBirth ? formatClinicDate(patient.dateOfBirth) : null) ||
                          `${patient.age} years`}
                      </p>
                    </div>
                    <ArrowRight
                      aria-hidden="true"
                      className="shrink-0 text-clinic-primary"
                      size={20}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </>
  );
}
