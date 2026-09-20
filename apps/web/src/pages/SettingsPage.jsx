import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle2, Save, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { clinicSettingsSchema } from '@clinicos/contracts';
import { ApiErrorNotice } from '../components/feedback/ApiErrorNotice.jsx';
import { FormField, inputClassName, textareaClassName } from '../components/forms/FormField.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { getSettings, updateSettings } from '../services/clinic.service.js';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const form = useForm({
    resolver: zodResolver(clinicSettingsSchema),
    defaultValues: {
      clinicName: '',
      address: '',
      phone: '',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      tokenPrefix: 'A',
      defaultConsultationFee: 0,
      language: 'en',
      receiptFormat: 'A5',
      prescriptionFooter: '',
      invoiceFooter: '',
    },
  });
  useEffect(() => {
    if (settingsQuery.data) form.reset(settingsQuery.data);
  }, [form, settingsQuery.data]);
  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (settings) => {
      queryClient.setQueryData(['settings'], settings);
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      queryClient.invalidateQueries({ queryKey: ['scheduling-context'] });
      form.reset(settings);
    },
  });

  if (settingsQuery.isLoading)
    return (
      <p className="rounded-2xl border border-clinic-border bg-clinic-surface p-10 text-center text-clinic-muted">
        Loading clinic settings…
      </p>
    );
  if (settingsQuery.isError) return <ApiErrorNotice error={settingsQuery.error} />;

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Clinic settings"
        description="Configure clinic identity, regional defaults, queue tokens, and printed document footers."
      />
      <form
        className="space-y-5"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        {mutation.isError ? <ApiErrorNotice error={mutation.error} /> : null}
        {mutation.isSuccess ? (
          <div
            className="flex items-center gap-2 rounded-xl border border-clinic-accent/30 bg-clinic-accent-soft p-4 text-sm font-semibold text-clinic-accent"
            role="status"
          >
            <CheckCircle2 aria-hidden="true" size={20} />
            Settings saved.
          </div>
        ) : null}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <section
              className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card sm:p-6"
              aria-labelledby="clinic-identity"
            >
              <div className="mb-5 flex items-center gap-3">
                <Building2 aria-hidden="true" className="text-clinic-primary" size={23} />
                <div>
                  <h2
                    id="clinic-identity"
                    className="font-display text-lg font-semibold text-clinic-text"
                  >
                    Clinic identity
                  </h2>
                  <p className="text-sm text-clinic-muted">
                    Shown on screens and printed documents.
                  </p>
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  id="clinicName"
                  label="Clinic name"
                  required
                  error={form.formState.errors.clinicName?.message}
                >
                  <input
                    id="clinicName"
                    className={inputClassName}
                    {...form.register('clinicName')}
                  />
                </FormField>
                <FormField
                  id="clinicPhone"
                  label="Phone"
                  error={form.formState.errors.phone?.message}
                >
                  <input
                    id="clinicPhone"
                    type="tel"
                    className={inputClassName}
                    {...form.register('phone')}
                  />
                </FormField>
                <div className="md:col-span-2">
                  <FormField
                    id="clinicAddress"
                    label="Address"
                    error={form.formState.errors.address?.message}
                  >
                    <textarea
                      id="clinicAddress"
                      className={textareaClassName}
                      {...form.register('address')}
                    />
                  </FormField>
                </div>
              </div>
            </section>
            <section
              className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card sm:p-6"
              aria-labelledby="document-settings"
            >
              <h2
                id="document-settings"
                className="font-display text-lg font-semibold text-clinic-text"
              >
                Documents and fees
              </h2>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <FormField
                  id="consultationFee"
                  label="Default consultation fee ₹"
                  error={form.formState.errors.defaultConsultationFee?.message}
                  helper="Set a positive amount before registering visits. A doctor-specific override can be set on the Staff page."
                >
                  <input
                    id="consultationFee"
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClassName}
                    {...form.register('defaultConsultationFee', { valueAsNumber: true })}
                  />
                </FormField>
                <FormField id="receiptFormat" label="Receipt format">
                  <select
                    id="receiptFormat"
                    className={inputClassName}
                    {...form.register('receiptFormat')}
                  >
                    <option value="A4">A4</option>
                    <option value="A5">A5</option>
                    <option value="THERMAL_80MM">80 mm thermal</option>
                  </select>
                </FormField>
                <div className="md:col-span-2">
                  <FormField id="prescriptionFooter" label="Prescription footer">
                    <textarea
                      id="prescriptionFooter"
                      className={textareaClassName}
                      {...form.register('prescriptionFooter')}
                    />
                  </FormField>
                </div>
                <div className="md:col-span-2">
                  <FormField id="invoiceFooter" label="Invoice footer">
                    <textarea
                      id="invoiceFooter"
                      className={textareaClassName}
                      {...form.register('invoiceFooter')}
                    />
                  </FormField>
                </div>
              </div>
            </section>
          </div>
          <aside className="space-y-5">
            <section className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card">
              <h2 className="font-display text-lg font-semibold text-clinic-text">
                Regional settings
              </h2>
              <div className="mt-5 space-y-4">
                <FormField id="timezone" label="Timezone" required>
                  <input id="timezone" className={inputClassName} {...form.register('timezone')} />
                </FormField>
                <FormField id="currency" label="Currency" required>
                  <input
                    id="currency"
                    maxLength="3"
                    className={inputClassName}
                    {...form.register('currency')}
                  />
                </FormField>
                <FormField id="language" label="Default language">
                  <select id="language" className={inputClassName} {...form.register('language')}>
                    <option value="en">English</option>
                    <option value="gu">Gujarati</option>
                    <option value="hi">Hindi</option>
                  </select>
                </FormField>
                <FormField id="tokenPrefix" label="Queue token prefix" required>
                  <input
                    id="tokenPrefix"
                    maxLength="8"
                    className={inputClassName}
                    {...form.register('tokenPrefix')}
                  />
                </FormField>
              </div>
            </section>
            <section className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card">
              <div className="flex items-center gap-3">
                <ShieldCheck aria-hidden="true" className="text-clinic-accent" size={22} />
                <h2 className="font-display text-lg font-semibold text-clinic-text">
                  Security note
                </h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-clinic-muted">
                Changes are permission-checked and written to the audit log. OpenEMR credentials
                remain server-side environment variables.
              </p>
            </section>
          </aside>
        </div>
        <div className="sticky bottom-3 z-10 flex justify-end rounded-2xl border border-clinic-border bg-clinic-surface/95 p-3 shadow-lg backdrop-blur">
          <button
            type="submit"
            disabled={mutation.isPending || !form.formState.isDirty}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-clinic-action px-6 font-bold text-white hover:bg-clinic-action-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save aria-hidden="true" size={18} />
            {mutation.isPending ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </>
  );
}
