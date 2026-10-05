import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, CalendarPlus, Clock3, LogIn, UserRoundPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { appointmentCreateSchema, walkInCreateSchema, PERMISSIONS } from '@clinicos/contracts';
import { useAuth } from '../hooks/useAuth.js';
import { useClinicClock } from '../hooks/useClinicClock.js';
import { formatClinicDate } from '../utils/format.js';
import { DateField } from '../components/forms/DateField.jsx';
import { ConsultationPayment } from '../components/billing/ConsultationPayment.jsx';
import { ApiErrorNotice } from '../components/feedback/ApiErrorNotice.jsx';
import { EmptyState } from '../components/feedback/EmptyState.jsx';
import { FormField, inputClassName, textareaClassName } from '../components/forms/FormField.jsx';
import { PatientPicker } from '../components/patients/PatientPicker.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import {
  checkInAppointment,
  createAppointment,
  createWalkIn,
  getPatient,
  listAppointments,
  getSchedulingContext,
} from '../services/clinic.service.js';

export default function AppointmentsPage() {
  const navigate = useNavigate();
  const [walkInAttempt, setWalkInAttempt] = useState(null);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const paymentPanel = useRef(null);
  const { user } = useAuth();
  const canManageVisit = [PERMISSIONS.QUEUE_MANAGE, PERMISSIONS.BILLING_VIEW].every((p) =>
    user.permissions.includes(p),
  );
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get('patientId');
  const [mode, setMode] = useState(
    searchParams.get('mode') === 'walk-in' ? 'walk-in' : 'appointment',
  );
  const [selectedPatientOverride, setSelectedPatientOverride] = useState(undefined);
  const queryClient = useQueryClient();
  const doctorsQuery = useQuery({
    queryKey: ['scheduling-context'],
    queryFn: getSchedulingContext,
    refetchOnWindowFocus: true,
  });
  const clock = useClinicClock(doctorsQuery.data?.timeZone);
  const today = clock.date;
  const appointmentsQuery = useQuery({
    queryKey: ['appointments', today],
    queryFn: () => listAppointments({ date: today }),
  });
  const preselectedQuery = useQuery({
    queryKey: ['patient', preselectedPatientId],
    queryFn: () => getPatient(preselectedPatientId),
    enabled: Boolean(preselectedPatientId),
  });

  const selectedPatient =
    selectedPatientOverride === undefined
      ? preselectedQuery.data?.patient || null
      : selectedPatientOverride;

  const appointmentForm = useForm({
    resolver: zodResolver(appointmentCreateSchema),
    defaultValues: {
      patientId: '',
      doctorId: '',
      date: today,
      time: clock.time,
      reason: '',
      visitType: 'NEW_CONSULTATION',
      notes: '',
      referralSource: '',
      reminderPreference: 'NONE',
    },
  });
  const walkInForm = useForm({
    resolver: zodResolver(walkInCreateSchema),
    defaultValues: { patientId: '', doctorId: '', reason: '', priority: 0 },
  });
  const selectedWalkInDoctorId = useWatch({ control: walkInForm.control, name: 'doctorId' });

  useEffect(() => {
    if (!appointmentForm.getFieldState('date').isDirty)
      appointmentForm.setValue('date', clock.date);
    if (!appointmentForm.getFieldState('time').isDirty)
      appointmentForm.setValue('time', clock.time);
  }, [clock.date, clock.time, appointmentForm]);

  useEffect(() => {
    if (paymentInvoice) {
      paymentPanel.current?.scrollIntoView({ block: 'start' });
      paymentPanel.current?.focus({ preventScroll: true });
    }
  }, [paymentInvoice]);

  useEffect(() => {
    const patientId = selectedPatient?.id || '';
    appointmentForm.setValue('patientId', patientId, { shouldValidate: Boolean(patientId) });
    walkInForm.setValue('patientId', patientId, { shouldValidate: Boolean(patientId) });
  }, [selectedPatient, appointmentForm, walkInForm]);

  const appointmentMutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      appointmentForm.reset({
        ...appointmentForm.getValues(),
        time: clock.time,
        reason: '',
        notes: '',
        referralSource: '',
      });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
  const walkInMutation = useMutation({
    mutationFn: ({ values, key }) => createWalkIn(values, key),
    onSuccess: ({ consultationInvoice }) => {
      setWalkInAttempt(null);
      walkInForm.reset({ ...walkInForm.getValues(), reason: '', priority: 0 });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      if (consultationInvoice?.id) setPaymentInvoice(consultationInvoice);
      else navigate('/app/queue');
    },
  });
  const checkInMutation = useMutation({
    mutationFn: checkInAppointment,
    onSuccess: ({ consultationInvoice }) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      if (consultationInvoice?.id) setPaymentInvoice(consultationInvoice);
      else navigate('/app/queue');
    },
  });

  const appointmentErrors = appointmentForm.formState.errors;
  const walkInErrors = walkInForm.formState.errors;
  const doctors = doctorsQuery.data?.doctors || [];
  const selectedWalkInDoctor = doctors.find((doctor) => doctor.id === selectedWalkInDoctorId);

  function registerWalkIn(values) {
    const fingerprint = JSON.stringify(values);
    const key =
      walkInAttempt?.fingerprint === fingerprint ? walkInAttempt.key : crypto.randomUUID();
    setWalkInAttempt({ fingerprint, key });
    walkInMutation.mutate({ values, key });
  }

  return (
    <>
      <PageHeader
        eyebrow="Scheduling"
        title="Appointments and walk-ins"
        description="Book a future visit, or register a walk-in. At check-in, collect the doctor fee before the patient enters the doctor queue."
        actions={
          <Link
            to="/app/calendar"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-clinic-border bg-clinic-surface px-4 text-sm font-bold text-clinic-text hover:bg-clinic-subtle"
          >
            <CalendarCheck aria-hidden="true" size={18} />
            Calendar view
          </Link>
        }
      />

      {paymentInvoice ? (
        <div ref={paymentPanel} tabIndex={-1} className="scroll-mt-24">
          <ConsultationPayment
            key={paymentInvoice.id}
            invoice={paymentInvoice}
            onClose={() => setPaymentInvoice(null)}
          />
        </div>
      ) : null}
      {doctorsQuery.isError ? <ApiErrorNotice error={doctorsQuery.error} /> : null}
      {doctors.some((doctor) => !(doctor.consultationFee > 0)) ? (
        <div
          className="mb-5 rounded-xl border border-clinic-warning/30 bg-clinic-warning-soft p-4 text-sm text-clinic-warning"
          role="status"
        >
          A consultation fee has not been configured for one or more doctors. Set a positive doctor
          fee or clinic default before registering or checking in their visits.
          {user.permissions.includes(PERMISSIONS.SETTINGS_UPDATE) ? (
            <Link
              className="ml-2 inline-flex min-h-11 items-center font-bold underline"
              to="/app/settings"
            >
              Set clinic consultation fee
            </Link>
          ) : (
            ' Ask the clinic administrator to configure the fee.'
          )}
          <button
            type="button"
            onClick={() => doctorsQuery.refetch()}
            className="ml-3 min-h-11 font-bold underline"
          >
            Refresh fees
          </button>
        </div>
      ) : null}

      <div
        className="mb-5 inline-flex rounded-xl border border-clinic-border bg-clinic-surface p-1"
        role="tablist"
        aria-label="Visit type"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'appointment'}
          onClick={() => setMode('appointment')}
          className={`min-h-11 rounded-lg px-4 text-sm font-bold ${mode === 'appointment' ? 'bg-clinic-action text-white' : 'text-clinic-muted hover:bg-clinic-subtle'}`}
        >
          Appointment
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'walk-in'}
          onClick={() => setMode('walk-in')}
          className={`min-h-11 rounded-lg px-4 text-sm font-bold ${mode === 'walk-in' ? 'bg-clinic-action text-white' : 'text-clinic-muted hover:bg-clinic-subtle'}`}
        >
          Walk-in
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(380px,0.85fr)_minmax(0,1.15fr)]">
        <section className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-clinic-primary-soft text-clinic-primary">
              {mode === 'appointment' ? (
                <CalendarPlus aria-hidden="true" size={21} />
              ) : (
                <UserRoundPlus aria-hidden="true" size={21} />
              )}
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-clinic-text">
                {mode === 'appointment' ? 'Book appointment' : 'Add walk-in'}
              </h2>
              <p className="text-sm text-clinic-muted">
                {mode === 'appointment'
                  ? 'Reserve a doctor and time slot.'
                  : 'Register the visit, then collect the doctor fee.'}
              </p>
            </div>
          </div>
          <PatientPicker selectedPatient={selectedPatient} onSelect={setSelectedPatientOverride} />

          {mode === 'appointment' ? (
            <form
              className="mt-5 space-y-5"
              onSubmit={appointmentForm.handleSubmit((values) =>
                appointmentMutation.mutate(values),
              )}
              noValidate
            >
              <input type="hidden" {...appointmentForm.register('patientId')} />
              {appointmentErrors.patientId ? (
                <p className="text-sm font-medium text-clinic-danger" role="alert">
                  Select a patient.
                </p>
              ) : null}
              <FormField
                id="appointmentDoctor"
                label="Doctor"
                required
                error={appointmentErrors.doctorId?.message}
              >
                <select
                  id="appointmentDoctor"
                  className={inputClassName}
                  {...appointmentForm.register('doctorId')}
                >
                  <option value="">Select doctor</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} ·{' '}
                      {doctor.consultationFee > 0
                        ? `₹${doctor.consultationFee.toLocaleString('en-IN')}`
                        : 'fee not set'}
                    </option>
                  ))}
                </select>
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="appointmentDate"
                  label="Date"
                  required
                  error={appointmentErrors.date?.message}
                >
                  <DateField id="appointmentDate" name="date" control={appointmentForm.control} />
                </FormField>
                <FormField
                  id="appointmentTime"
                  label="Time"
                  required
                  error={appointmentErrors.time?.message}
                >
                  <input
                    id="appointmentTime"
                    type="time"
                    className={inputClassName}
                    {...appointmentForm.register('time')}
                  />
                </FormField>
              </div>
              <FormField
                id="visitType"
                label="Visit type"
                required
                error={appointmentErrors.visitType?.message}
              >
                <select
                  id="visitType"
                  className={inputClassName}
                  {...appointmentForm.register('visitType')}
                >
                  {[
                    'NEW_CONSULTATION',
                    'FOLLOW_UP',
                    'PROCEDURE',
                    'REVIEW',
                    'LAB_ONLY',
                    'VACCINATION',
                    'CUSTOM',
                  ].map((type) => (
                    <option key={type} value={type}>
                      {type.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                id="appointmentReason"
                label="Reason for visit"
                required
                error={appointmentErrors.reason?.message}
              >
                <textarea
                  id="appointmentReason"
                  className={textareaClassName}
                  {...appointmentForm.register('reason')}
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="reminderPreference" label="Reminder">
                  <select
                    id="reminderPreference"
                    className={inputClassName}
                    {...appointmentForm.register('reminderPreference')}
                  >
                    <option value="NONE">No reminder</option>
                    <option value="SMS">SMS</option>
                    <option value="WHATSAPP">WhatsApp</option>
                  </select>
                </FormField>
                <FormField id="referralSource" label="Referral source">
                  <input
                    id="referralSource"
                    className={inputClassName}
                    {...appointmentForm.register('referralSource')}
                  />
                </FormField>
              </div>
              <FormField id="appointmentNotes" label="Notes">
                <textarea
                  id="appointmentNotes"
                  className={textareaClassName}
                  {...appointmentForm.register('notes')}
                />
              </FormField>
              {appointmentMutation.isError ? (
                <ApiErrorNotice error={appointmentMutation.error} />
              ) : null}
              {appointmentMutation.isSuccess ? (
                <p
                  className="rounded-xl bg-clinic-accent-soft p-3 text-sm font-semibold text-clinic-accent"
                  role="status"
                >
                  Appointment booked successfully.
                </p>
              ) : null}
              <button
                type="submit"
                disabled={
                  appointmentMutation.isPending ||
                  !doctors.length ||
                  !user.permissions.includes(PERMISSIONS.APPOINTMENT_CREATE)
                }
                className="min-h-12 w-full rounded-xl bg-clinic-action px-5 font-bold text-white hover:bg-clinic-action-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {appointmentMutation.isPending ? 'Booking…' : 'Book appointment'}
              </button>
            </form>
          ) : (
            <form
              className="mt-5 space-y-5"
              onSubmit={walkInForm.handleSubmit(registerWalkIn)}
              noValidate
            >
              <p className="text-sm text-clinic-muted">
                Walk-in date/time: {formatClinicDate(today)} {clock.time} · captured automatically.
                Consultation payment is collected here after registration.
              </p>
              <input type="hidden" {...walkInForm.register('patientId')} />
              {walkInErrors.patientId ? (
                <p className="text-sm font-medium text-clinic-danger" role="alert">
                  Select a patient.
                </p>
              ) : null}
              <FormField
                id="walkInDoctor"
                label="Doctor"
                required
                error={walkInErrors.doctorId?.message}
              >
                <select
                  id="walkInDoctor"
                  className={inputClassName}
                  {...walkInForm.register('doctorId')}
                >
                  <option value="">Select doctor</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} ·{' '}
                      {doctor.consultationFee > 0
                        ? `₹${doctor.consultationFee.toLocaleString('en-IN')}`
                        : 'fee not set'}
                    </option>
                  ))}
                </select>
              </FormField>
              {selectedWalkInDoctor?.consultationFee > 0 ? (
                <p className="rounded-xl bg-clinic-primary-soft p-3 text-sm font-semibold text-clinic-primary">
                  Consultation fee due now: ₹
                  {selectedWalkInDoctor.consultationFee.toLocaleString('en-IN')}
                </p>
              ) : selectedWalkInDoctor ? (
                <p role="status" className="text-sm font-semibold text-clinic-warning">
                  Fee not configured — this is not a free consultation. Use the setup link above.
                </p>
              ) : null}
              <FormField
                id="walkInReason"
                label="Reason for visit"
                required
                error={walkInErrors.reason?.message}
              >
                <textarea
                  id="walkInReason"
                  className={textareaClassName}
                  {...walkInForm.register('reason')}
                />
              </FormField>
              <FormField
                id="priority"
                label="Priority"
                required
                error={walkInErrors.priority?.message}
              >
                <select
                  id="priority"
                  className={inputClassName}
                  {...walkInForm.register('priority', { valueAsNumber: true })}
                >
                  <option value="0">Routine</option>
                  <option value="50">Urgent</option>
                  <option value="100">Emergency</option>
                </select>
              </FormField>
              {walkInMutation.isError ? <ApiErrorNotice error={walkInMutation.error} /> : null}
              {walkInMutation.isSuccess ? (
                <p
                  className="rounded-xl bg-clinic-accent-soft p-3 text-sm font-semibold text-clinic-accent"
                  role="status"
                >
                  Visit registered. Payment status is shown on its consultation invoice.
                </p>
              ) : null}
              <button
                type="submit"
                disabled={
                  walkInMutation.isPending ||
                  Boolean(paymentInvoice) ||
                  !canManageVisit ||
                  !doctors.length ||
                  !selectedWalkInDoctor?.consultationFee
                }
                className="min-h-12 w-full rounded-xl bg-clinic-action px-5 font-bold text-white hover:bg-clinic-action-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {walkInMutation.isPending ? 'Registering…' : 'Register and collect fee'}
              </button>
            </form>
          )}
          {!doctorsQuery.isLoading && !doctors.length ? (
            <p className="mt-4 rounded-xl bg-clinic-warning-soft p-3 text-sm text-clinic-warning">
              No active doctor is available. Add a doctor from Staff before booking visits.
            </p>
          ) : null}
        </section>

        <section
          className="overflow-hidden rounded-2xl border border-clinic-border bg-clinic-surface shadow-card"
          aria-labelledby="today-appointments"
        >
          <div className="border-b border-clinic-border px-5 py-4 sm:px-6">
            <h2
              id="today-appointments"
              className="font-display text-lg font-semibold text-clinic-text"
            >
              Today’s appointments
            </h2>
            <p className="mt-1 text-sm text-clinic-muted">{formatClinicDate(today)}</p>
          </div>
          {checkInMutation.isError ? (
            <div className="border-b border-clinic-border p-5">
              <ApiErrorNotice error={checkInMutation.error} />
            </div>
          ) : null}
          {appointmentsQuery.isError ? (
            <div className="p-5">
              <ApiErrorNotice error={appointmentsQuery.error} />
            </div>
          ) : null}
          {appointmentsQuery.isLoading ? (
            <p className="p-8 text-center text-sm text-clinic-muted">Loading appointments…</p>
          ) : null}
          {!appointmentsQuery.isLoading && !appointmentsQuery.data?.length ? (
            <EmptyState
              compact
              icon={Clock3}
              title="No appointments today"
              description="Booked visits for today will appear here in time order."
            />
          ) : null}
          {appointmentsQuery.data?.length ? (
            <ul className="divide-y divide-clinic-border">
              {appointmentsQuery.data.map((appointment) => (
                <li key={appointment.id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-clinic-text">
                        {appointment.time} · {appointment.patientId?.fullName}
                      </p>
                      <p className="mt-1 text-sm text-clinic-muted">
                        {appointment.doctorId?.name} · {appointment.reason}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={appointment.status} />
                      {['SCHEDULED', 'CHECKED_IN'].includes(appointment.status) ? (
                        <button
                          type="button"
                          onClick={() => checkInMutation.mutate(appointment.id)}
                          disabled={
                            checkInMutation.isPending || Boolean(paymentInvoice) || !canManageVisit
                          }
                          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-clinic-primary px-3 text-sm font-bold text-clinic-primary hover:bg-clinic-primary-soft disabled:opacity-50"
                        >
                          <LogIn aria-hidden="true" size={17} />
                          {appointment.status === 'SCHEDULED'
                            ? 'Check in and collect fee'
                            : 'Open visit'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </>
  );
}
