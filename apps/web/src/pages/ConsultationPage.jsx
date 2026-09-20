import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileText, Plus, Printer, Save, Stethoscope, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { encounterUpdateSchema, vitalsSchema } from '@clinicos/contracts';
import { ApiErrorNotice } from '../components/feedback/ApiErrorNotice.jsx';
import { FormField, inputClassName, textareaClassName } from '../components/forms/FormField.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import {
  completeEncounter,
  getEncounterForQueue,
  saveEncounter,
  saveVitals,
  startEncounter,
} from '../services/clinic.service.js';

const consultationFormSchema = encounterUpdateSchema
  .omit({ diagnoses: true })
  .extend({ diagnosesText: z.string().max(2000).optional() });
const optionalNumber = { setValueAs: (value) => (value === '' ? undefined : Number(value)) };

export default function ConsultationPage() {
  const { queueId } = useParams();
  const queryClient = useQueryClient();
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
    if (!encounter) return;
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
    vitalsForm.reset(encounter.vitals || {});
  }, [encounter, consultationForm, vitalsForm]);

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
        description={`${patient?.patientNumber} · ${patient?.gender?.toLowerCase()} · ${patient?.dateOfBirth || `${patient?.age || 'Age not recorded'} years`} · Dr. ${doctor?.name}`}
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
              <div className="flex items-center gap-2 text-sm font-bold text-clinic-accent">
                <CheckCircle2 aria-hidden="true" size={20} />
                Completed {formatClinicDateTime(encounter.completedAt)}
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

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
            <div className="space-y-5">
              <section
                className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card sm:p-6"
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
                <div className="space-y-5">
                  <FormField
                    id="chiefComplaint"
                    label="Chief complaint"
                    required
                    error={consultationForm.formState.errors.chiefComplaint?.message}
                  >
                    <textarea
                      id="chiefComplaint"
                      disabled={isCompleted}
                      className={textareaClassName}
                      {...consultationForm.register('chiefComplaint')}
                    />
                  </FormField>
                  <FormField id="historyPresentIllness" label="History of present illness">
                    <textarea
                      id="historyPresentIllness"
                      disabled={isCompleted}
                      className={textareaClassName}
                      {...consultationForm.register('historyPresentIllness')}
                    />
                  </FormField>
                  <FormField id="examination" label="Examination">
                    <textarea
                      id="examination"
                      disabled={isCompleted}
                      className={textareaClassName}
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
                      className={textareaClassName}
                      {...consultationForm.register('diagnosesText')}
                    />
                  </FormField>
                  <FormField id="assessment" label="Assessment" required>
                    <textarea
                      id="assessment"
                      disabled={isCompleted}
                      className={textareaClassName}
                      {...consultationForm.register('assessment')}
                    />
                  </FormField>
                  <FormField id="plan" label="Plan">
                    <textarea
                      id="plan"
                      disabled={isCompleted}
                      className={textareaClassName}
                      {...consultationForm.register('plan')}
                    />
                  </FormField>
                  <FormField id="followUpDate" label="Follow-up date">
                    <DateField
                      id="followUpDate"
                      name="followUpDate"
                      control={consultationForm.control}
                      disabled={isCompleted}
                    />
                  </FormField>
                </div>
              </section>

              <section
                className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card sm:p-6"
                aria-labelledby="prescription-heading"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2
                      id="prescription-heading"
                      className="font-display text-lg font-semibold text-clinic-text"
                    >
                      Prescription
                    </h2>
                    <p className="mt-1 text-sm text-clinic-muted">
                      Medication instructions for this visit.
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
                  <div className="mt-5 space-y-4">
                    {prescriptionFields.fields.map((field, index) => (
                      <fieldset
                        key={field.id}
                        className="rounded-xl border border-clinic-border p-4"
                      >
                        <legend className="px-2 text-sm font-bold text-clinic-text">
                          Medicine {index + 1}
                        </legend>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField
                            id={`medicine-${index}`}
                            label="Medicine"
                            required
                            error={
                              consultationForm.formState.errors.prescriptions?.[index]?.medicine
                                ?.message
                            }
                          >
                            <input
                              id={`medicine-${index}`}
                              disabled={isCompleted}
                              className={inputClassName}
                              {...consultationForm.register(`prescriptions.${index}.medicine`)}
                            />
                          </FormField>
                          <FormField id={`dose-${index}`} label="Dose" required>
                            <input
                              id={`dose-${index}`}
                              disabled={isCompleted}
                              className={inputClassName}
                              placeholder="e.g. 500 mg"
                              {...consultationForm.register(`prescriptions.${index}.dose`)}
                            />
                          </FormField>
                          <FormField id={`frequency-${index}`} label="Frequency" required>
                            <input
                              id={`frequency-${index}`}
                              disabled={isCompleted}
                              className={inputClassName}
                              placeholder="e.g. twice daily"
                              {...consultationForm.register(`prescriptions.${index}.frequency`)}
                            />
                          </FormField>
                          <FormField id={`duration-${index}`} label="Duration" required>
                            <input
                              id={`duration-${index}`}
                              disabled={isCompleted}
                              className={inputClassName}
                              placeholder="e.g. 5 days"
                              {...consultationForm.register(`prescriptions.${index}.duration`)}
                            />
                          </FormField>
                          <FormField id={`quantity-${index}`} label="Quantity">
                            <input
                              id={`quantity-${index}`}
                              disabled={isCompleted}
                              type="number"
                              min="1"
                              className={inputClassName}
                              {...consultationForm.register(`prescriptions.${index}.quantity`, {
                                valueAsNumber: true,
                              })}
                            />
                          </FormField>
                          <FormField id={`instructions-${index}`} label="Instructions">
                            <input
                              id={`instructions-${index}`}
                              disabled={isCompleted}
                              className={inputClassName}
                              {...consultationForm.register(`prescriptions.${index}.instructions`)}
                            />
                          </FormField>
                        </div>
                        {!isCompleted ? (
                          <button
                            type="button"
                            onClick={() => prescriptionFields.remove(index)}
                            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold text-clinic-danger hover:bg-clinic-danger-soft"
                          >
                            <Trash2 aria-hidden="true" size={16} />
                            Remove
                          </button>
                        ) : null}
                      </fieldset>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-5">
              <section
                className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card"
                aria-labelledby="vitals-heading"
              >
                <h2
                  id="vitals-heading"
                  className="font-display text-lg font-semibold text-clinic-text"
                >
                  Vitals
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <FormField id="temperatureC" label="Temperature °C">
                    <input
                      id="temperatureC"
                      disabled={isCompleted}
                      type="number"
                      step="0.1"
                      className={inputClassName}
                      {...vitalsForm.register('temperatureC', optionalNumber)}
                    />
                  </FormField>
                  <FormField id="pulseBpm" label="Pulse bpm">
                    <input
                      id="pulseBpm"
                      disabled={isCompleted}
                      type="number"
                      className={inputClassName}
                      {...vitalsForm.register('pulseBpm', optionalNumber)}
                    />
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField id="systolicBp" label="BP systolic">
                      <input
                        id="systolicBp"
                        disabled={isCompleted}
                        type="number"
                        className={inputClassName}
                        {...vitalsForm.register('systolicBp', optionalNumber)}
                      />
                    </FormField>
                    <FormField id="diastolicBp" label="BP diastolic">
                      <input
                        id="diastolicBp"
                        disabled={isCompleted}
                        type="number"
                        className={inputClassName}
                        {...vitalsForm.register('diastolicBp', optionalNumber)}
                      />
                    </FormField>
                  </div>
                  <FormField id="oxygenSaturation" label="SpO₂ %">
                    <input
                      id="oxygenSaturation"
                      disabled={isCompleted}
                      type="number"
                      step="0.1"
                      className={inputClassName}
                      {...vitalsForm.register('oxygenSaturation', optionalNumber)}
                    />
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField id="weightKg" label="Weight kg">
                      <input
                        id="weightKg"
                        disabled={isCompleted}
                        type="number"
                        step="0.1"
                        className={inputClassName}
                        {...vitalsForm.register('weightKg', optionalNumber)}
                      />
                    </FormField>
                    <FormField id="heightCm" label="Height cm">
                      <input
                        id="heightCm"
                        disabled={isCompleted}
                        type="number"
                        step="0.1"
                        className={inputClassName}
                        {...vitalsForm.register('heightCm', optionalNumber)}
                      />
                    </FormField>
                  </div>
                </div>
                {vitalsMutation.isError ? (
                  <div className="mt-4">
                    <ApiErrorNotice error={vitalsMutation.error} />
                  </div>
                ) : null}
                {!isCompleted ? (
                  <button
                    type="button"
                    onClick={vitalsForm.handleSubmit((values) => vitalsMutation.mutate(values))}
                    disabled={vitalsMutation.isPending}
                    className="mt-4 min-h-11 w-full rounded-xl border border-clinic-primary px-4 text-sm font-bold text-clinic-primary hover:bg-clinic-primary-soft disabled:opacity-50"
                  >
                    {vitalsMutation.isPending ? 'Saving…' : 'Save vitals'}
                  </button>
                ) : null}
              </section>
            </aside>
          </div>

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
                Complete consultation
              </button>
            </div>
          ) : null}
        </form>
      )}
    </>
  );
}
import { formatClinicDateTime } from '../utils/format.js';
import { DateField } from '../components/forms/DateField.jsx';
