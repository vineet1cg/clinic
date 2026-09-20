import { useQuery } from '@tanstack/react-query';
import { Activity, CalendarDays, Clock3, IndianRupee, Users } from 'lucide-react';
import { useState } from 'react';
import { ApiErrorNotice } from '../components/feedback/ApiErrorNotice.jsx';
import { inputClassName } from '../components/forms/FormField.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { StatCard } from '../components/ui/StatCard.jsx';
import { getReportSummary } from '../services/clinic.service.js';
import { clinicClock, formatClinicDate, parseDisplayDate } from '../utils/format.js';

function today() {
  return clinicClock().date;
}

function Breakdown({ title, values, currency = false, emptyMessage }) {
  return (
    <section className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card">
      <h2 className="font-display text-lg font-semibold text-clinic-text">{title}</h2>
      <dl className="mt-4 space-y-3">
        {Object.entries(values).length ? (
          Object.entries(values).map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between gap-3 border-b border-clinic-border pb-3 text-sm"
            >
              <dt className="font-semibold text-clinic-muted">{label.replaceAll('_', ' ')}</dt>
              <dd className="font-bold text-clinic-text">
                {currency ? '₹' : ''}
                {value.toLocaleString('en-IN')}
              </dd>
            </div>
          ))
        ) : (
          <p className="text-sm text-clinic-muted">{emptyMessage}</p>
        )}
      </dl>
    </section>
  );
}

export default function ReportsPage() {
  const currentDate = today();
  const [range, setRange] = useState({ from: currentDate, to: currentDate });
  const validRange =
    /^\d{4}-\d{2}-\d{2}$/.test(range.from) &&
    /^\d{4}-\d{2}-\d{2}$/.test(range.to) &&
    range.from <= range.to;
  const reportQuery = useQuery({
    queryKey: ['reports', range],
    queryFn: () => getReportSummary(range),
    enabled: validRange,
  });
  const report = reportQuery.data;

  return (
    <>
      <PageHeader
        eyebrow="Management"
        title="Reports"
        description="Operational and financial totals are independently protected by your permissions."
      />
      <section className="mb-5 rounded-2xl border border-clinic-border bg-clinic-surface p-4 shadow-card sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div>
            <label
              htmlFor="reportFrom"
              className="mb-2 block text-sm font-semibold text-clinic-text"
            >
              From
            </label>
            <input
              id="reportFrom"
              type="text"
              inputMode="numeric"
              placeholder="dd/mm/yyyy"
              maxLength={10}
              className={inputClassName}
              value={
                /^\d{4}-\d{2}-\d{2}$/.test(range.from) ? formatClinicDate(range.from) : range.from
              }
              onChange={(event) =>
                setRange((current) => ({ ...current, from: parseDisplayDate(event.target.value) }))
              }
            />
          </div>
          <div>
            <label htmlFor="reportTo" className="mb-2 block text-sm font-semibold text-clinic-text">
              To
            </label>
            <input
              id="reportTo"
              type="text"
              inputMode="numeric"
              placeholder="dd/mm/yyyy"
              maxLength={10}
              className={inputClassName}
              value={/^\d{4}-\d{2}-\d{2}$/.test(range.to) ? formatClinicDate(range.to) : range.to}
              onChange={(event) =>
                setRange((current) => ({ ...current, to: parseDisplayDate(event.target.value) }))
              }
            />
          </div>
          <button
            type="button"
            onClick={() => setRange({ from: currentDate, to: currentDate })}
            className="min-h-12 cursor-pointer rounded-xl border border-clinic-border px-4 text-sm font-bold text-clinic-text transition-colors hover:bg-clinic-subtle"
          >
            Today
          </button>
        </div>
      </section>
      {!validRange ? (
        <p role="alert" className="mb-4 text-clinic-danger">
          Enter valid dates as dd/mm/yyyy, with From on or before To.
        </p>
      ) : null}
      {reportQuery.isError ? <ApiErrorNotice error={reportQuery.error} /> : null}
      {reportQuery.isLoading ? (
        <p className="rounded-2xl border border-clinic-border bg-clinic-surface p-10 text-center text-clinic-muted">
          Calculating reports…
        </p>
      ) : null}
      {report ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {report.access.operational ? (
              <>
                <StatCard
                  label="Patients registered"
                  value={report.metrics.registeredPatients}
                  helper={`${report.range.from} to ${report.range.to}`}
                  icon={Users}
                />
                <StatCard
                  label="Appointments"
                  value={report.metrics.appointments}
                  helper={`${report.metrics.cancelledAppointments} cancelled`}
                  icon={CalendarDays}
                />
                <StatCard
                  label="Average wait"
                  value={`${report.metrics.averageWaitMinutes} min`}
                  helper={`${report.metrics.waiting} currently waiting`}
                  icon={Clock3}
                  tone="warning"
                />
              </>
            ) : null}
            {report.access.financial ? (
              <StatCard
                label="Revenue"
                value={`₹${report.metrics.revenue.toLocaleString('en-IN')}`}
                helper={`₹${report.metrics.outstanding.toLocaleString('en-IN')} outstanding`}
                icon={IndianRupee}
                tone="success"
              />
            ) : null}
          </section>
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {report.access.operational ? (
              <>
                <Breakdown
                  title="Queue by stage"
                  values={report.queueByState}
                  emptyMessage="No queue activity in this range."
                />
                <section className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card">
                  <div className="flex items-center gap-3">
                    <Activity aria-hidden="true" className="text-clinic-primary" size={22} />
                    <h2 className="font-display text-lg font-semibold text-clinic-text">
                      Clinic activity
                    </h2>
                  </div>
                  <dl className="mt-4 space-y-4">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-clinic-muted">
                        Completed visits
                      </dt>
                      <dd className="mt-1 text-2xl font-bold text-clinic-text">
                        {report.metrics.completed}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-clinic-muted">
                        Walk-ins
                      </dt>
                      <dd className="mt-1 text-2xl font-bold text-clinic-text">
                        {report.metrics.walkIns}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-clinic-muted">
                        Active doctors
                      </dt>
                      <dd className="mt-1 text-2xl font-bold text-clinic-text">
                        {report.metrics.doctorsActive}
                      </dd>
                    </div>
                  </dl>
                </section>
              </>
            ) : null}
            {report.access.financial ? (
              <Breakdown
                title="Payment methods"
                values={report.revenueByMethod}
                currency
                emptyMessage="No payments in this range."
              />
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}
