import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { calculateAge, patientCreateSchema } from '@clinicos/contracts';
import { DateField } from '../components/forms/DateField.jsx';
import { useClinicClock } from '../hooks/useClinicClock.js';
import { formatClinicDate } from '../utils/format.js';
import { ApiErrorNotice } from '../components/feedback/ApiErrorNotice.jsx';
import { FormField, inputClassName, textareaClassName } from '../components/forms/FormField.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { createPatient } from '../services/clinic.service.js';
import { getApiError } from '../services/http.js';

const optionalValue = { setValueAs: (value) => (value === '' ? undefined : value) };

export default function PatientRegistrationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [duplicates, setDuplicates] = useState([]);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const clock = useClinicClock();
  const mutation = useMutation({
    mutationFn: createPatient,
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      navigate(`/app/patients/${patient.id}`, { replace: true, state: { created: true } });
    },
  });
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(patientCreateSchema),
    defaultValues: {
      fullName: '',
      mobile: '+91',
      gender: '',
      dateOfBirth: undefined,
      age: undefined,
      email: '',
      address: '',
      city: '',
      state: '',
      pinCode: undefined,
      emergencyContact: undefined,
      bloodGroup: 'UNKNOWN',
      preferredLanguage: 'en',
      governmentId: '',
      abhaId: '',
      allowDuplicate: false,
    },
  });

  const dateOfBirth = useWatch({ control, name: 'dateOfBirth' });
  useEffect(() => {
    if (dateOfBirth)
      setValue('age', calculateAge(dateOfBirth, clock.date), { shouldValidate: true });
  }, [dateOfBirth, clock.date, setValue]);

  async function onSubmit(values) {
    try {
      await mutation.mutateAsync({ ...values, allowDuplicate });
    } catch (error) {
      const apiError = getApiError(error);
      if (apiError.code === 'POSSIBLE_DUPLICATE_PATIENT') {
        setDuplicates(apiError.details);
      }
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Front desk"
        title="Register patient"
        description="Create the patient record first. Then register today's visit and collect the doctor fee before the patient enters the queue."
        actions={
          <Link
            to="/app/patients"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-clinic-border bg-clinic-surface px-4 py-2.5 text-sm font-bold text-clinic-text hover:bg-clinic-subtle"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            Back to patients
          </Link>
        }
      />

      {mutation.isError && !duplicates.length ? (
        <div className="mb-5">
          <ApiErrorNotice error={mutation.error} />
        </div>
      ) : null}

      {duplicates.length ? (
        <section
          className="mb-5 rounded-2xl border border-clinic-warning/30 bg-clinic-warning-soft p-5"
          aria-labelledby="duplicate-title"
        >
          <div className="flex gap-3">
            <ShieldAlert
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-clinic-warning"
              size={22}
            />
            <div className="min-w-0">
              <h2
                id="duplicate-title"
                className="font-display text-lg font-semibold text-clinic-text"
              >
                Possible existing patient found
              </h2>
              <p className="mt-1 text-sm text-clinic-muted">
                Open the matching record when it is the same person. Only create another record when
                you can explain why.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {duplicates.map((patient) => (
              <Link
                key={patient.id}
                to={`/app/patients/${patient.id}`}
                className="rounded-xl border border-clinic-warning/30 bg-clinic-surface p-4 hover:border-clinic-warning"
              >
                <p className="font-bold text-clinic-text">{patient.fullName}</p>
                <p className="mt-1 text-sm text-clinic-muted">
                  {patient.patientNumber} · {patient.mobile}
                </p>
                <p className="mt-1 text-xs font-semibold text-clinic-primary">
                  Open existing record
                </p>
              </Link>
            ))}
          </div>
          {!allowDuplicate ? (
            <button
              type="button"
              onClick={() => setAllowDuplicate(true)}
              className="mt-4 min-h-11 rounded-xl border border-clinic-warning px-4 text-sm font-bold text-clinic-warning hover:bg-clinic-surface"
            >
              This is a different patient
            </button>
          ) : null}
        </section>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <section
          className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card sm:p-6"
          aria-labelledby="identity-heading"
        >
          <div className="mb-5">
            <h2
              id="identity-heading"
              className="font-display text-lg font-semibold text-clinic-text"
            >
              Patient identity
            </h2>
            <p className="mt-1 text-sm text-clinic-muted">
              Fields marked with an asterisk are required. Registration date and time:{' '}
              {formatClinicDate(clock.date)} {clock.time}. Saved automatically by the server.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <FormField id="fullName" label="Full name" required error={errors.fullName?.message}>
              <input
                id="fullName"
                className={inputClassName}
                autoComplete="name"
                {...register('fullName')}
              />
            </FormField>
            <FormField
              id="mobile"
              label="Mobile number"
              required
              error={errors.mobile?.message}
              helper="Include the country code, for example +91."
            >
              <input
                id="mobile"
                type="tel"
                inputMode="tel"
                className={inputClassName}
                autoComplete="tel"
                {...register('mobile')}
              />
            </FormField>
            <FormField id="gender" label="Gender" required error={errors.gender?.message}>
              <select id="gender" className={inputClassName} {...register('gender')}>
                <option value="">Select gender</option>
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
                <option value="OTHER">Other</option>
                <option value="UNKNOWN">Prefer not to say</option>
              </select>
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="dateOfBirth" label="Date of birth" error={errors.dateOfBirth?.message}>
                <DateField id="dateOfBirth" name="dateOfBirth" control={control} />
              </FormField>
              <FormField
                id="age"
                label={dateOfBirth ? 'Age (calculated)' : 'Or age'}
                error={errors.age?.message}
                helper={
                  dateOfBirth
                    ? 'Calculated in completed years from date of birth.'
                    : 'Enter age if the exact birth date is unknown.'
                }
              >
                <input
                  id="age"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="130"
                  readOnly={Boolean(dateOfBirth)}
                  className={inputClassName}
                  {...register('age', {
                    setValueAs: (value) => (value === '' ? undefined : Number(value)),
                  })}
                />
              </FormField>
            </div>
          </div>
        </section>

        <section
          className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card sm:p-6"
          aria-labelledby="contact-heading"
        >
          <h2 id="contact-heading" className="font-display text-lg font-semibold text-clinic-text">
            Contact and address
          </h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <FormField id="email" label="Email" error={errors.email?.message}>
              <input
                id="email"
                type="email"
                className={inputClassName}
                autoComplete="email"
                {...register('email')}
              />
            </FormField>
            <FormField
              id="emergencyContact"
              label="Emergency contact"
              error={errors.emergencyContact?.message}
            >
              <input
                id="emergencyContact"
                type="tel"
                className={inputClassName}
                {...register('emergencyContact', optionalValue)}
              />
            </FormField>
            <div className="md:col-span-2">
              <FormField id="address" label="Address" error={errors.address?.message}>
                <textarea
                  id="address"
                  className={textareaClassName}
                  autoComplete="street-address"
                  {...register('address')}
                />
              </FormField>
            </div>
            <FormField id="city" label="City" error={errors.city?.message}>
              <input
                id="city"
                className={inputClassName}
                autoComplete="address-level2"
                {...register('city')}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="state" label="State" error={errors.state?.message}>
                <input
                  id="state"
                  className={inputClassName}
                  autoComplete="address-level1"
                  {...register('state')}
                />
              </FormField>
              <FormField id="pinCode" label="PIN code" error={errors.pinCode?.message}>
                <input
                  id="pinCode"
                  inputMode="numeric"
                  maxLength="6"
                  className={inputClassName}
                  autoComplete="postal-code"
                  {...register('pinCode', optionalValue)}
                />
              </FormField>
            </div>
          </div>
        </section>

        <section
          className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card sm:p-6"
          aria-labelledby="details-heading"
        >
          <h2 id="details-heading" className="font-display text-lg font-semibold text-clinic-text">
            Additional details
          </h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <FormField id="bloodGroup" label="Blood group" error={errors.bloodGroup?.message}>
              <select id="bloodGroup" className={inputClassName} {...register('bloodGroup')}>
                {['UNKNOWN', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((value) => (
                  <option key={value} value={value}>
                    {value === 'UNKNOWN' ? 'Unknown' : value}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              id="preferredLanguage"
              label="Preferred language"
              error={errors.preferredLanguage?.message}
            >
              <select
                id="preferredLanguage"
                className={inputClassName}
                {...register('preferredLanguage')}
              >
                <option value="en">English</option>
                <option value="gu">Gujarati</option>
                <option value="hi">Hindi</option>
              </select>
            </FormField>
            <FormField id="governmentId" label="Government ID" error={errors.governmentId?.message}>
              <input id="governmentId" className={inputClassName} {...register('governmentId')} />
            </FormField>
            <FormField id="abhaId" label="ABHA ID" error={errors.abhaId?.message}>
              <input id="abhaId" className={inputClassName} {...register('abhaId')} />
            </FormField>
            {allowDuplicate ? (
              <div className="md:col-span-2">
                <FormField
                  id="duplicateReason"
                  label="Reason for separate record"
                  required
                  error={errors.duplicateReason?.message}
                >
                  <textarea
                    id="duplicateReason"
                    className={textareaClassName}
                    {...register('duplicateReason')}
                  />
                </FormField>
              </div>
            ) : null}
          </div>
        </section>

        <div className="sticky bottom-3 z-10 flex flex-col-reverse gap-3 rounded-2xl border border-clinic-border bg-clinic-surface/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
          <Link
            to="/app/patients"
            className="inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-bold text-clinic-muted hover:bg-clinic-subtle"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-clinic-action px-6 text-sm font-bold text-white hover:bg-clinic-action-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? (
              'Registering patient…'
            ) : (
              <>
                <Save aria-hidden="true" size={18} />
                Register patient
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );
}
