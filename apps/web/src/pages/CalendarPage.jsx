import { useQuery } from '@tanstack/react-query';
import { addDays, format, startOfWeek } from 'date-fns';
import { ArrowLeft, ArrowRight, CalendarDays, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiErrorNotice } from '../components/feedback/ApiErrorNotice.jsx';
import { EmptyState } from '../components/feedback/EmptyState.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { listAppointments } from '../services/clinic.service.js';

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const from = format(days[0], 'yyyy-MM-dd');
  const to = format(days[6], 'yyyy-MM-dd');
  const appointmentsQuery = useQuery({
    queryKey: ['appointments', 'calendar', from, to],
    queryFn: () => listAppointments({ from, to }),
  });
  const appointments = appointmentsQuery.data || [];

  return (
    <>
      <PageHeader
        eyebrow="Scheduling"
        title="Clinic calendar"
        description="A clear weekly view of doctor schedules and patient bookings."
        actions={
          <Link
            to="/app/appointments"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-clinic-action px-4 text-sm font-bold text-white hover:bg-clinic-action-hover"
          >
            <Plus aria-hidden="true" size={18} />
            New visit
          </Link>
        }
      />
      <section className="overflow-hidden rounded-2xl border border-clinic-border bg-clinic-surface shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinic-border p-4 sm:px-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-clinic-text">
              {format(days[0], 'dd/MM/yyyy')} – {format(days[6], 'dd/MM/yyyy')}
            </h2>
            <p className="mt-1 text-sm text-clinic-muted">
              {appointments.length} booking{appointments.length === 1 ? '' : 's'} this week
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Previous week"
              onClick={() => setWeekStart((date) => addDays(date, -7))}
              className="flex size-11 items-center justify-center rounded-xl border border-clinic-border text-clinic-text hover:bg-clinic-subtle"
            >
              <ArrowLeft aria-hidden="true" size={19} />
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              className="min-h-11 rounded-xl border border-clinic-border px-4 text-sm font-bold text-clinic-text hover:bg-clinic-subtle"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next week"
              onClick={() => setWeekStart((date) => addDays(date, 7))}
              className="flex size-11 items-center justify-center rounded-xl border border-clinic-border text-clinic-text hover:bg-clinic-subtle"
            >
              <ArrowRight aria-hidden="true" size={19} />
            </button>
          </div>
        </div>
        {appointmentsQuery.isError ? (
          <div className="p-5">
            <ApiErrorNotice error={appointmentsQuery.error} />
          </div>
        ) : null}
        {appointmentsQuery.isLoading ? (
          <p className="p-10 text-center text-sm text-clinic-muted">Loading clinic calendar…</p>
        ) : null}
        {!appointmentsQuery.isLoading && !appointments.length ? (
          <EmptyState
            icon={CalendarDays}
            title="No bookings this week"
            description="Use New visit to schedule the first appointment."
          />
        ) : null}
        {appointments.length ? (
          <div className="grid divide-y divide-clinic-border lg:grid-cols-7 lg:divide-x lg:divide-y-0">
            {days.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayAppointments = appointments.filter(
                (appointment) => appointment.date === dayKey,
              );
              return (
                <section
                  key={dayKey}
                  className="min-h-40 p-3"
                  aria-label={format(day, 'EEEE d MMMM')}
                >
                  <div className="mb-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-clinic-muted">
                      {format(day, 'EEE')}
                    </p>
                    <p className="font-display text-lg font-semibold text-clinic-text">
                      {format(day, 'd')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {dayAppointments.map((appointment) => (
                      <article
                        key={appointment.id}
                        className="rounded-lg border border-clinic-border bg-clinic-bg p-2.5"
                      >
                        <p className="text-xs font-bold text-clinic-primary">{appointment.time}</p>
                        <p className="mt-1 text-sm font-bold text-clinic-text">
                          {appointment.patientId?.fullName}
                        </p>
                        <p className="mt-1 truncate text-xs text-clinic-muted">
                          {appointment.doctorId?.name}
                        </p>
                        <div className="mt-2">
                          <StatusBadge status={appointment.status} />
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}
      </section>
    </>
  );
}
