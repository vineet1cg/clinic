import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Plus,
  Printer,
  Save,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { encounterUpdateSchema, vitalsSchema } from '@clinicos/contracts';
import { ApiErrorNotice } from '../components/feedback/ApiErrorNotice.jsx';
import { DateField } from '../components/forms/DateField.jsx';
import { FormField } from '../components/forms/FormField.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import {
  completeEncounter,
  getEncounterForQueue,
  saveEncounter,
  saveVitals,
  startEncounter,
} from '../services/clinic.service.js';
import { formatClinicDate, formatClinicDateTime } from '../utils/format.js';
import {
  DURATION_UNITS,
  MEDICATION_MEAL_TIMINGS,
  MEDICATION_TIMES,
  formatMedicationDuration,
  formatMedicationFrequency,
  medicationScheduleSlot,
  parseMedicationDuration,
  parseMedicationRowSchedule,
} from '../utils/prescription.js';

const consultationFormSchema = encounterUpdateSchema
  .omit({ diagnoses: true })
  .extend({ diagnosesText: z.string().max(2000).optional() });
const optionalNumber = { setValueAs: (value) => (value === '' ? undefined : Number(value)) };
const compactInputClassName =
  'min-h-11 w-full rounded-lg border border-clinic-border bg-clinic-surface px-3 py-2 text-sm text-clinic-text placeholder:text-clinic-muted/70 hover:border-clinic-primary disabled:cursor-not-allowed disabled:bg-clinic-subtle disabled:opacity-70';
const clinicalTextareaClassName =
  'min-h-24 w-full resize-y rounded-xl border border-clinic-border bg-clinic-surface px-3.5 py-2.5 text-base text-clinic-text placeholder:text-clinic-muted/70 hover:border-clinic-primary disabled:cursor-not-allowed disabled:bg-clinic-subtle disabled:opacity-70';

function MedicationScheduleCells({ control, index, disabled }) {
  return (
    <Controller
      control={control}
      name={`prescriptions.${index}.frequency`}
      render={({ field: { value, onChange }, fieldState }) => (
        <MedicationScheduleInputs
          disabled={disabled}
          scheduleValue={value}
          onScheduleChange={onChange}
          fieldState={fieldState}
          index={index}
        />
      )}
    />
  );
}

function MedicationScheduleInputs({
  scheduleValue,
  onScheduleChange,
  fieldState,
  index,
  disabled,
}) {
  const parsedSchedule = parseMedicationRowSchedule(scheduleValue);
  const [mealTiming, setMealTiming] = useState(parsedSchedule.mealTiming);
  const selectedTimes = parsedSchedule.custom ? [] : parsedSchedule.times;

  const updateTimes = (times, nextMealTiming = mealTiming) => {
    onScheduleChange(
      formatMedicationFrequency(times.map((time) => medicationScheduleSlot(nextMealTiming, time))),
    );
  };

  return (
    <>
      <td className="min-w-36 border-r border-clinic-border p-2 align-top">
        <label className="sr-only" htmlFor={`meal-timing-${index}`}>
          Meal timing for medicine {index + 1}
        </label>
        <select
          id={`meal-timing-${index}`}
          disabled={disabled}
          value={mealTiming}
          onChange={(event) => {
            const nextMealTiming = event.target.value;
            setMealTiming(nextMealTiming);
            if (selectedTimes.length) updateTimes(selectedTimes, nextMealTiming);
          }}
          className={compactInputClassName}
          aria-invalid={Boolean(fieldState.error)}
        >
          {MEDICATION_MEAL_TIMINGS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {parsedSchedule.custom ? (
          <p className="mt-1 text-xs leading-4 text-clinic-warning">
            Previous: {parsedSchedule.custom}. Select a time to normalize it.
          </p>
        ) : null}
        {fieldState.error ? (
          <p className="mt-1 text-xs text-clinic-danger" role="alert">
            {fieldState.error.message}
          </p>
        ) : null}
      </td>
      {MEDICATION_TIMES.map((time) => {
        const checked = selectedTimes.includes(time);
        return (
          <td
            key={time}
            className="min-w-16 border-r border-clinic-border px-1 py-2 text-center align-middle"
          >
            <input
              id={`frequency-${index}-${time.toLowerCase()}`}
              type="checkbox"
              disabled={disabled}
              checked={checked}
              onChange={(event) => {
                const nextTimes = event.target.checked
                  ? [...selectedTimes, time]
                  : selectedTimes.filter((value) => value !== time);
                updateTimes(nextTimes);
              }}
              aria-label={`${time}, ${mealTiming.toLowerCase()}, medicine ${index + 1}`}
              className="size-5 cursor-pointer accent-clinic-primary disabled:cursor-not-allowed"
            />
          </td>
        );
      })}
    </>
  );
}

function VitalsSection({ form, mutation, disabled }) {
  return (
    <section
      className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card sm:p-6"
      aria-labelledby="vitals-heading"
    >
      <div>
        <h2 id="vitals-heading" className="font-display text-lg font-semibold text-clinic-text">
          Vitals
        </h2>
        <p className="mt-1 text-sm text-clinic-muted">
          Record the patient’s current measurements before completing the clinical notes.
        </p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormField id="temperatureC" label="Temperature °C">
          <input
            id="temperatureC"
            disabled={disabled}
            type="number"
            step="0.1"
            className={compactInputClassName}
            {...form.register('temperatureC', optionalNumber)}
          />
        </FormField>
        <FormField id="pulseBpm" label="Pulse bpm">
          <input
            id="pulseBpm"
            disabled={disabled}
            type="number"
            className={compactInputClassName}
            {...form.register('pulseBpm', optionalNumber)}
          />
        </FormField>
        <FormField id="systolicBp" label="BP systolic">
          <input
            id="systolicBp"
            disabled={disabled}
            type="number"
            className={compactInputClassName}
            {...form.register('systolicBp', optionalNumber)}
          />
        </FormField>
        <FormField id="diastolicBp" label="BP diastolic">
          <input
            id="diastolicBp"
            disabled={disabled}
            type="number"
            className={compactInputClassName}
            {...form.register('diastolicBp', optionalNumber)}
          />
        </FormField>
        <FormField id="oxygenSaturation" label="SpO₂ %">
          <input
            id="oxygenSaturation"
            disabled={disabled}
            type="number"
            step="0.1"
            className={compactInputClassName}
            {...form.register('oxygenSaturation', optionalNumber)}
          />
        </FormField>
        <FormField id="weightKg" label="Weight kg">
          <input
            id="weightKg"
            disabled={disabled}
            type="number"
            step="0.1"
            className={compactInputClassName}
            {...form.register('weightKg', optionalNumber)}
          />
        </FormField>
        <FormField id="heightCm" label="Height cm">
          <input
            id="heightCm"
            disabled={disabled}
            type="number"
            step="0.1"
            className={compactInputClassName}
            {...form.register('heightCm', optionalNumber)}
          />
        </FormField>
        {!disabled ? (
          <div className="flex items-end">
            <button
              type="button"
              onClick={form.handleSubmit((values) => mutation.mutate(values))}
              disabled={mutation.isPending}
              className="min-h-11 w-full rounded-lg border border-clinic-primary px-4 text-sm font-bold text-clinic-primary hover:bg-clinic-primary-soft disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving…' : 'Save vitals'}
            </button>
          </div>
        ) : null}
      </div>
      {mutation.isError ? (
        <div className="mt-4">
          <ApiErrorNotice error={mutation.error} />
        </div>
      ) : null}
    </section>
  );
}

export default function ConsultationPage() {
  const { queueId } = useParams();
  const queryClient = useQueryClient();
  const initializedEncounterId = useRef(null);
  const consultationQuery = useQuery({
    queryKey: ['encounter', 'queue', queueId],
    queryFn: () => getEncounterForQueue(queueId),
  });
  const encounter = consultationQuery.data?.encounter;
  const queueEntry = consultationQuery.data?.queueEntry;
  const consultationForm = useForm({
    resolver: zodResolver(consultationFormSchema),
    defaultValues: {
      chiefComplaint: '',
      historyPresentIllness: '',
      examination: '',
      assessment: '',
      plan: '',
      diagnosesText: '',
      prescriptions: [],
      followUpDate: '',
    },
  });
  const prescriptionFields = useFieldArray({
    control: consultationForm.control,
    name: 'prescriptions',
  });
  const vitalsForm = useForm({ resolver: zodResolver(vitalsSchema), defaultValues: {} });

  useEffect(() => {
    if (!encounter || initializedEncounterId.current === encounter.id) return;
    initializedEncounterId.current = encounter.id;
    consultationForm.reset({
      chiefComplaint: encounter.chiefComplaint || '',
      historyPresentIllness: encounter.historyPresentIllness || '',
      examination: encounter.examination || '',
      assessment: encounter.assessment || '',
      plan: encounter.plan || '',
      diagnosesText: encounter.diagnoses?.join('\n') || '',
      prescriptions: encounter.prescriptions || [],
      followUpDate: encounter.followUpDate || '',
    });
  }, [encounter, consultationForm]);

  useEffect(() => {
    if (encounter) vitalsForm.reset(encounter.vitals || {});
  }, [encounter, vitalsForm]);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['encounter', 'queue', queueId] });
  const startMutation = useMutation({
    mutationFn: () => startEncounter(queueId),
    onSuccess: refresh,
  });
  const saveMutation = useMutation({
    mutationFn: (input) => saveEncounter(encounter.id, input),
    onSuccess: refresh,
  });
  const vitalsMutation = useMutation({
    mutationFn: (input) => saveVitals(encounter.id, input),
    onSuccess: refresh,
  });
  const completeMutation = useMutation({
    mutationFn: () => completeEncounter(encounter.id),
    onSuccess: refresh,
  });

  function toEncounterInput(values) {
    return {
      ...values,
      diagnoses: (values.diagnosesText || '')
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean),
      diagnosesText: undefined,
      prescriptions: values.prescriptions || [],
    };
  }

  async function saveAndComplete(values) {
    await saveMutation.mutateAsync(toEncounterInput(values));
    await completeMutation.mutateAsync();
  }

  if (consultationQuery.isLoading)
    return (
      <p className="rounded-2xl border border-clinic-border bg-clinic-surface p-10 text-center text-clinic-muted">
        Loading consultation workspace…
      </p>
    );
  if (consultationQuery.isError) return <ApiErrorNotice error={consultationQuery.error} />;

  const patient = encounter?.patientId || queueEntry?.patientId;
  const doctor = encounter?.doctorId || queueEntry?.doctorId;
  const isCompleted = encounter?.status === 'COMPLETED';

  return (
    <>
      <PageHeader
        eyebrow={`Token ${queueEntry?.tokenNumber}`}
        title={patient?.fullName || 'Consultation'}
        description={`${patient?.patientNumber} · ${patient?.gender?.toLowerCase()} · ${patient?.dateOfBirth ? formatClinicDate(patient.dateOfBirth) : `${patient?.age ?? 'Age not recorded'}${patient?.age != null ? ' years' : ''}`} · Dr. ${doctor?.name}`}
        actions={
          <>
            <Link
              to="/app/queue"
              className="inline-flex min-h-11 items-center rounded-xl border border-clinic-border bg-clinic-surface px-4 text-sm font-bold text-clinic-text hover:bg-clinic-subtle"
            >
              Back to queue
            </Link>
            {encounter ? (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-clinic-border bg-clinic-surface px-4 text-sm font-bold text-clinic-text hover:bg-clinic-subtle"
              >
                <Printer aria-hidden="true" size={18} />
                Print
              </button>
            ) : null}
          </>
        }
      />

      {!encounter ? (
        <section className="rounded-2xl border border-clinic-border bg-clinic-surface p-8 text-center shadow-card">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-clinic-primary-soft text-clinic-primary">
            <Stethoscope aria-hidden="true" size={27} />
          </span>
          <h2 className="mt-4 font-display text-xl font-semibold text-clinic-text">
            Patient is ready for consultation
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-clinic-muted">
            Starting creates an audited consultation draft and moves the token to In consultation.
          </p>
          {startMutation.isError ? (
            <div className="mx-auto mt-5 max-w-lg">
              <ApiErrorNotice error={startMutation.error} />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            className="mt-6 min-h-12 rounded-xl bg-clinic-action px-6 font-bold text-white hover:bg-clinic-action-hover disabled:opacity-50"
          >
            {startMutation.isPending ? 'Starting…' : 'Start consultation'}
          </button>
        </section>
      ) : (
        <form
          onSubmit={consultationForm.handleSubmit((values) =>
            saveMutation.mutate(toEncounterInput(values)),
          )}
          className="space-y-5"
          noValidate
        >
          <div className="flex items-center justify-between rounded-xl border border-clinic-border bg-clinic-surface px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-clinic-muted">
                Consultation status
              </p>
              <div className="mt-1">
                <StatusBadge status={encounter.status} />
              </div>
            </div>
            {isCompleted ? (
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm font-bold text-clinic-accent">
                  <CheckCircle2 aria-hidden="true" size={20} />
                  Completed {formatClinicDateTime(encounter.completedAt)}
                </div>
                <p className="mt-1 text-xs text-clinic-muted">
                  Returned to reception for final billing.
                </p>
              </div>
            ) : (
              <p className="text-sm text-clinic-muted">Drafts are saved explicitly.</p>
            )}
          </div>

          {saveMutation.isError || completeMutation.isError ? (
            <ApiErrorNotice error={saveMutation.error || completeMutation.error} />
          ) : null}
          {saveMutation.isSuccess && !completeMutation.isSuccess ? (
            <p
              className="rounded-xl bg-clinic-accent-soft p-3 text-sm font-semibold text-clinic-accent"
              role="status"
            >
              Consultation draft saved.
            </p>
          ) : null}

          <VitalsSection form={vitalsForm} mutation={vitalsMutation} disabled={isCompleted} />

          <div className="min-w-0">
            <div className="min-w-0 space-y-5">
              <section
                className="min-w-0 rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card sm:p-6"
                aria-labelledby="clinical-notes"
              >
                <div className="mb-5 flex items-center gap-3">
                  <FileText aria-hidden="true" className="text-clinic-primary" size={22} />
                  <h2
                    id="clinical-notes"
                    className="font-display text-lg font-semibold text-clinic-text"
                  >
                    Clinical notes
                  </h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    id="chiefComplaint"
                    label="Chief complaint"
                    required
                    error={consultationForm.formState.errors.chiefComplaint?.message}
                  >
                    <textarea
                      id="chiefComplaint"
                      disabled={isCompleted}
                      className={clinicalTextareaClassName}
                      {...consultationForm.register('chiefComplaint')}
                    />
                  </FormField>
                  <FormField id="historyPresentIllness" label="History of present illness">
                    <textarea
                      id="historyPresentIllness"
                      disabled={isCompleted}
                      className={clinicalTextareaClassName}
                      {...consultationForm.register('historyPresentIllness')}
                    />
                  </FormField>
                  <FormField id="examination" label="Examination">
                    <textarea
                      id="examination"
                      disabled={isCompleted}
                      className={clinicalTextareaClassName}
                      {...consultationForm.register('examination')}
                    />
                  </FormField>
                  <FormField
                    id="diagnosesText"
                    label="Diagnoses"
                    helper="Enter one diagnosis per line."
                  >
                    <textarea
                      id="diagnosesText"
                      disabled={isCompleted}
                      className={clinicalTextareaClassName}
                      {...consultationForm.register('diagnosesText')}
                    />
                  </FormField>
                  <FormField id="assessment" label="Assessment" required>
                    <textarea
                      id="assessment"
                      disabled={isCompleted}
                      className={clinicalTextareaClassName}
                      {...consultationForm.register('assessment')}
                    />
                  </FormField>
                  <FormField id="plan" label="Plan">
                    <textarea
                      id="plan"
                      disabled={isCompleted}
                      className={clinicalTextareaClassName}
                      {...consultationForm.register('plan')}
                    />
                  </FormField>
                </div>
              </section>

              <section
                className="min-w-0 overflow-x-hidden rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card sm:p-6"
                aria-labelledby="prescription-heading"
              >
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <h2
                      id="prescription-heading"
                      className="font-display text-lg font-semibold text-clinic-text"
                    >
                      Prescription
                    </h2>
                    <p className="mt-1 text-sm text-clinic-muted">
                      One medicine per row. Select at least one dose schedule for each medicine.
                    </p>
                  </div>
                  {!isCompleted ? (
                    <button
                      type="button"
                      onClick={() =>
                        prescriptionFields.append({
                          medicine: '',
                          dose: '',
                          frequency: '',
                          duration: '',
                          instructions: '',
                          quantity: 1,
                        })
                      }
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-clinic-primary px-3 text-sm font-bold text-clinic-primary hover:bg-clinic-primary-soft"
                    >
                      <Plus aria-hidden="true" size={17} />
                      Add medicine
                    </button>
                  ) : null}
                </div>
                {!prescriptionFields.fields.length ? (
                  <p className="mt-5 rounded-xl bg-clinic-bg p-4 text-sm text-clinic-muted">
                    No medicines added.
                  </p>
                ) : (
                  <div className="prescription-table-shell mt-4 w-full max-w-full overflow-hidden rounded-xl border border-clinic-border">
                    <div className="w-full max-w-full overflow-x-auto">
                      <table className="w-full min-w-[920px] border-collapse text-sm">
                        <caption className="sr-only">
                          Prescription medicines and their dose schedules
                        </caption>
                        <thead className="bg-clinic-subtle text-clinic-text">
                          <tr>
                            <th
                              scope="col"
                              className="sticky left-0 z-20 min-w-40 border-b border-r border-clinic-border bg-clinic-subtle px-2 py-2 text-left font-semibold"
                            >
                              Medicine <span className="text-clinic-danger">*</span>
                            </th>
                            <th
                              scope="col"
                              className="min-w-24 border-b border-r border-clinic-border px-2 py-2 text-left font-semibold"
                            >
                              Dose <span className="text-clinic-danger">*</span>
                            </th>
                            <th
                              scope="col"
                              className="min-w-36 border-b border-r border-clinic-border px-2 py-2 text-left font-semibold"
                            >
                              Meal timing
                            </th>
                            {MEDICATION_TIMES.map((time) => (
                              <th
                                key={time}
                                scope="col"
                                className="min-w-16 border-b border-r border-clinic-border px-1 py-2 text-center text-xs font-semibold"
                              >
                                {time}
                              </th>
                            ))}
                            <th
                              scope="col"
                              className="min-w-[156px] border-b border-r border-clinic-border px-2 py-2 text-left font-semibold"
                            >
                              Duration <span className="text-clinic-danger">*</span>
                            </th>
                            <th
                              scope="col"
                              className="min-w-16 border-b border-r border-clinic-border px-2 py-2 text-left font-semibold"
                            >
                              Qty
                            </th>
                            <th
                              scope="col"
                              className="min-w-32 border-b border-r border-clinic-border px-2 py-2 text-left font-semibold"
                            >
                              Instructions
                            </th>
                            <th
                              scope="col"
                              className="w-12 border-b border-clinic-border px-2 py-2 text-center font-semibold"
                            >
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-clinic-border bg-clinic-surface">
                          {prescriptionFields.fields.map((field, index) => {
                            const rowErrors =
                              consultationForm.formState.errors.prescriptions?.[index];
                            return (
                              <tr key={field.id}>
                                <td className="sticky left-0 z-10 min-w-40 border-r border-clinic-border bg-clinic-surface p-2 align-top shadow-[6px_0_10px_-10px_rgba(15,23,42,0.7)]">
                                  <label className="sr-only" htmlFor={`medicine-${index}`}>
                                    Medicine {index + 1}
                                  </label>
                                  <input
                                    id={`medicine-${index}`}
                                    disabled={isCompleted}
                                    className={compactInputClassName}
                                    aria-invalid={Boolean(rowErrors?.medicine)}
                                    {...consultationForm.register(
                                      `prescriptions.${index}.medicine`,
                                    )}
                                  />
                                  {rowErrors?.medicine ? (
                                    <p className="mt-1 text-xs text-clinic-danger" role="alert">
                                      {rowErrors.medicine.message}
                                    </p>
                                  ) : null}
                                </td>
                                <td className="min-w-24 border-r border-clinic-border p-2 align-top">
                                  <label className="sr-only" htmlFor={`dose-${index}`}>
                                    Dose for medicine {index + 1}
                                  </label>
                                  <input
                                    id={`dose-${index}`}
                                    disabled={isCompleted}
                                    className={compactInputClassName}
                                    placeholder="500 mg"
                                    aria-invalid={Boolean(rowErrors?.dose)}
                                    {...consultationForm.register(`prescriptions.${index}.dose`)}
                                  />
                                  {rowErrors?.dose ? (
                                    <p className="mt-1 text-xs text-clinic-danger" role="alert">
                                      {rowErrors.dose.message}
                                    </p>
                                  ) : null}
                                </td>
                                <MedicationScheduleCells
                                  control={consultationForm.control}
                                  index={index}
                                  disabled={isCompleted}
                                />
                                <Controller
                                  control={consultationForm.control}
                                  name={`prescriptions.${index}.duration`}
                                  render={({ field: durationField, fieldState }) => {
                                    const parsedDuration = parseMedicationDuration(
                                      durationField.value,
                                    );
                                    const updateDuration = (amount, unit) =>
                                      durationField.onChange(
                                        formatMedicationDuration(amount, unit),
                                      );
                                    return (
                                      <td className="min-w-[156px] border-r border-clinic-border p-2 align-top">
                                        <div className="grid grid-cols-[48px_88px] gap-1.5">
                                          <input
                                            id={`duration-amount-${index}`}
                                            ref={durationField.ref}
                                            type="number"
                                            inputMode="numeric"
                                            min="1"
                                            max="365"
                                            disabled={isCompleted}
                                            value={parsedDuration.amount}
                                            onBlur={durationField.onBlur}
                                            onChange={(event) =>
                                              updateDuration(
                                                event.target.value,
                                                parsedDuration.unit,
                                              )
                                            }
                                            className={compactInputClassName}
                                            aria-label={`Duration amount for medicine ${index + 1}`}
                                            aria-invalid={Boolean(fieldState.error)}
                                          />
                                          <select
                                            id={`duration-unit-${index}`}
                                            disabled={isCompleted}
                                            value={parsedDuration.unit}
                                            onChange={(event) =>
                                              updateDuration(
                                                parsedDuration.amount,
                                                event.target.value,
                                              )
                                            }
                                            className={compactInputClassName}
                                            aria-label={`Duration unit for medicine ${index + 1}`}
                                          >
                                            {DURATION_UNITS.map((unit) => (
                                              <option key={unit} value={unit}>
                                                {unit[0].toUpperCase() + unit.slice(1)}(s)
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        {parsedDuration.custom ? (
                                          <p className="mt-1 text-xs text-clinic-warning">
                                            Previous: {parsedDuration.custom}
                                          </p>
                                        ) : null}
                                        {fieldState.error ? (
                                          <p
                                            className="mt-1 text-xs text-clinic-danger"
                                            role="alert"
                                          >
                                            {fieldState.error.message}
                                          </p>
                                        ) : null}
                                      </td>
                                    );
                                  }}
                                />
                                <td className="min-w-16 border-r border-clinic-border p-2 align-top">
                                  <label className="sr-only" htmlFor={`quantity-${index}`}>
                                    Quantity for medicine {index + 1}
                                  </label>
                                  <input
                                    id={`quantity-${index}`}
                                    disabled={isCompleted}
                                    type="number"
                                    min="1"
                                    className={compactInputClassName}
                                    aria-invalid={Boolean(rowErrors?.quantity)}
                                    {...consultationForm.register(
                                      `prescriptions.${index}.quantity`,
                                      { valueAsNumber: true },
                                    )}
                                  />
                                </td>
                                <td className="min-w-32 border-r border-clinic-border p-2 align-top">
                                  <label className="sr-only" htmlFor={`instructions-${index}`}>
                                    Instructions for medicine {index + 1}
                                  </label>
                                  <input
                                    id={`instructions-${index}`}
                                    disabled={isCompleted}
                                    className={compactInputClassName}
                                    {...consultationForm.register(
                                      `prescriptions.${index}.instructions`,
                                    )}
                                  />
                                </td>
                                <td className="w-12 p-2 text-center align-top">
                                  {!isCompleted ? (
                                    <button
                                      type="button"
                                      onClick={() => prescriptionFields.remove(index)}
                                      className="inline-flex size-11 items-center justify-center rounded-lg text-clinic-danger hover:bg-clinic-danger-soft"
                                      aria-label={`Remove medicine ${index + 1}`}
                                      title={`Remove medicine ${index + 1}`}
                                    >
                                      <Trash2 aria-hidden="true" size={17} />
                                    </button>
                                  ) : (
                                    <span className="text-clinic-muted" aria-hidden="true">
                                      —
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>

          <section
            className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card sm:p-6"
            aria-labelledby="follow-up-heading"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-clinic-primary-soft text-clinic-primary">
                <CalendarClock aria-hidden="true" size={22} />
              </span>
              <div>
                <h2
                  id="follow-up-heading"
                  className="font-display text-lg font-semibold text-clinic-text"
                >
                  Next follow-up
                </h2>
                <p className="mt-1 text-sm text-clinic-muted">
                  Set the patient’s next review date after completing the clinical plan and
                  prescription.
                </p>
              </div>
            </div>
            <div className="mt-5 max-w-sm">
              <FormField id="followUpDate" label="Next follow-up date">
                <DateField
                  id="followUpDate"
                  name="followUpDate"
                  control={consultationForm.control}
                  disabled={isCompleted}
                />
              </FormField>
            </div>
          </section>

          {!isCompleted ? (
            <div className="sticky bottom-3 z-10 flex flex-col-reverse gap-3 rounded-2xl border border-clinic-border bg-clinic-surface/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
              <button
                type="submit"
                disabled={saveMutation.isPending || completeMutation.isPending}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-clinic-primary px-5 font-bold text-clinic-primary hover:bg-clinic-primary-soft disabled:opacity-50"
              >
                <Save aria-hidden="true" size={18} />
                Save draft
              </button>
              <button
                type="button"
                onClick={consultationForm.handleSubmit(saveAndComplete)}
                disabled={saveMutation.isPending || completeMutation.isPending}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-clinic-positive-action px-5 font-bold text-white hover:bg-clinic-positive-action-hover disabled:opacity-50"
              >
                <CheckCircle2 aria-hidden="true" size={18} />
                Complete &amp; return to reception
              </button>
            </div>
          ) : null}
        </form>
      )}
    </>
  );
}
