import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, FilePlus2, IndianRupee, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { invoiceCreateSchema } from '@clinicos/contracts';
import { ApiErrorNotice } from '../components/feedback/ApiErrorNotice.jsx';
import { EmptyState } from '../components/feedback/EmptyState.jsx';
import { FormField, inputClassName } from '../components/forms/FormField.jsx';
import { PatientPicker } from '../components/patients/PatientPicker.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { createInvoice, getPatient, listInvoices } from '../services/clinic.service.js';
import { formatClinicDate } from '../utils/format.js';

export default function BillingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const preselectedPatientId = searchParams.get('patientId');
  const queueEntryId = searchParams.get('queueEntryId');
  const [selectedPatientOverride, setSelectedPatientOverride] = useState(undefined);
  const invoicesQuery = useQuery({ queryKey: ['invoices'], queryFn: () => listInvoices() });
  const visitInvoiceQuery = useQuery({
    queryKey: ['invoices', 'queue-entry', queueEntryId],
    queryFn: () => listInvoices({ queueEntryId, purpose: 'GENERAL' }),
    enabled: Boolean(queueEntryId),
  });
  const patientQuery = useQuery({
    queryKey: ['patient', preselectedPatientId],
    queryFn: () => getPatient(preselectedPatientId),
    enabled: Boolean(preselectedPatientId),
  });
  const form = useForm({
    resolver: zodResolver(invoiceCreateSchema),
    defaultValues: {
      patientId: '',
      queueEntryId: queueEntryId || undefined,
      doctorId: searchParams.get('doctorId') || undefined,
      items: [{ description: '', quantity: 1, rate: 0 }],
      discount: 0,
      notes: '',
    },
  });
  const itemFields = useFieldArray({ control: form.control, name: 'items' });
  const mutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      navigate(`/app/billing/${invoice.id}`);
    },
  });

  const selectedPatient =
    selectedPatientOverride === undefined
      ? patientQuery.data?.patient || null
      : selectedPatientOverride;
  useEffect(() => {
    form.setValue('patientId', selectedPatient?.id || '', {
      shouldValidate: Boolean(selectedPatient),
    });
  }, [form, selectedPatient]);
  useEffect(() => {
    const existingInvoice = visitInvoiceQuery.data?.[0];
    if (existingInvoice) navigate(`/app/billing/${existingInvoice.id}`, { replace: true });
  }, [navigate, visitInvoiceQuery.data]);

  const watchedItems = useWatch({ control: form.control, name: 'items' });
  const watchedDiscount = Number(useWatch({ control: form.control, name: 'discount' }) || 0);
  const subtotal = (watchedItems || []).reduce(
    (total, item) => total + Number(item.quantity || 0) * Number(item.rate || 0),
    0,
  );
  const total = Math.max(0, subtotal - watchedDiscount);

  return (
    <>
      <PageHeader
        eyebrow="Accounts"
        title="Billing"
        description="Create itemized invoices, collect payments, and keep clinical notes out of financial records."
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(380px,0.85fr)_minmax(0,1.15fr)]">
        <section className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-clinic-primary-soft text-clinic-primary">
              <FilePlus2 aria-hidden="true" size={21} />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-clinic-text">New invoice</h2>
              <p className="text-sm text-clinic-muted">
                Add extra services and confirm the amount. The doctor fee is billed at check-in.
              </p>
            </div>
          </div>
          <PatientPicker selectedPatient={selectedPatient} onSelect={setSelectedPatientOverride} />
          <form
            className="mt-5 space-y-5"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            noValidate
          >
            <input type="hidden" {...form.register('patientId')} />
            <input type="hidden" {...form.register('queueEntryId')} />
            <input type="hidden" {...form.register('doctorId')} />
            {form.formState.errors.patientId ? (
              <p className="text-sm font-medium text-clinic-danger" role="alert">
                Select a patient.
              </p>
            ) : null}
            <fieldset>
              <div className="flex items-center justify-between">
                <legend className="text-sm font-semibold text-clinic-text">Invoice items</legend>
                <button
                  type="button"
                  onClick={() => itemFields.append({ description: '', quantity: 1, rate: 0 })}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold text-clinic-primary hover:bg-clinic-primary-soft"
                >
                  <Plus aria-hidden="true" size={17} />
                  Add item
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {itemFields.fields.map((field, index) => (
                  <div key={field.id} className="rounded-xl border border-clinic-border p-3">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_90px_120px_44px]">
                      <FormField
                        id={`item-description-${index}`}
                        label="Description"
                        error={form.formState.errors.items?.[index]?.description?.message}
                      >
                        <input
                          id={`item-description-${index}`}
                          className={inputClassName}
                          {...form.register(`items.${index}.description`)}
                        />
                      </FormField>
                      <FormField id={`item-quantity-${index}`} label="Qty">
                        <input
                          id={`item-quantity-${index}`}
                          type="number"
                          min="0.01"
                          step="0.01"
                          className={inputClassName}
                          {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                        />
                      </FormField>
                      <FormField id={`item-rate-${index}`} label="Rate ₹">
                        <input
                          id={`item-rate-${index}`}
                          type="number"
                          min="0"
                          step="0.01"
                          className={inputClassName}
                          {...form.register(`items.${index}.rate`, { valueAsNumber: true })}
                        />
                      </FormField>
                      <button
                        type="button"
                        aria-label={`Remove item ${index + 1}`}
                        onClick={() => itemFields.remove(index)}
                        disabled={itemFields.fields.length === 1}
                        className="mt-7 flex size-11 items-center justify-center rounded-lg text-clinic-danger hover:bg-clinic-danger-soft disabled:opacity-30"
                      >
                        <Trash2 aria-hidden="true" size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
            <FormField
              id="discount"
              label="Discount ₹"
              error={form.formState.errors.discount?.message}
            >
              <input
                id="discount"
                type="number"
                min="0"
                step="0.01"
                className={inputClassName}
                {...form.register('discount', { valueAsNumber: true })}
              />
            </FormField>
            <div className="rounded-xl bg-clinic-bg p-4">
              <div className="flex justify-between text-sm text-clinic-muted">
                <span>Subtotal</span>
                <span>₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-clinic-border pt-2 text-lg font-bold text-clinic-text">
                <span>Total</span>
                <span>₹{total.toLocaleString('en-IN')}</span>
              </div>
            </div>
            {mutation.isError ? <ApiErrorNotice error={mutation.error} /> : null}
            {visitInvoiceQuery.isError ? <ApiErrorNotice error={visitInvoiceQuery.error} /> : null}
            <button
              type="submit"
              disabled={mutation.isPending || visitInvoiceQuery.isLoading}
              className="min-h-12 w-full rounded-xl bg-clinic-action px-5 font-bold text-white hover:bg-clinic-action-hover disabled:opacity-50"
            >
              {mutation.isPending
                ? 'Creating invoice…'
                : visitInvoiceQuery.isLoading
                  ? 'Checking visit billing…'
                  : 'Create invoice'}
            </button>
          </form>
        </section>

        <section
          className="overflow-hidden rounded-2xl border border-clinic-border bg-clinic-surface shadow-card"
          aria-labelledby="recent-invoices"
        >
          <div className="border-b border-clinic-border px-5 py-4 sm:px-6">
            <h2
              id="recent-invoices"
              className="font-display text-lg font-semibold text-clinic-text"
            >
              Recent invoices
            </h2>
            <p className="mt-1 text-sm text-clinic-muted">Newest invoices first</p>
          </div>
          {invoicesQuery.isError ? (
            <div className="p-5">
              <ApiErrorNotice error={invoicesQuery.error} />
            </div>
          ) : null}
          {invoicesQuery.isLoading ? (
            <p className="p-10 text-center text-sm text-clinic-muted">Loading invoices…</p>
          ) : null}
          {!invoicesQuery.isLoading && !invoicesQuery.data?.length ? (
            <EmptyState
              icon={CreditCard}
              title="No invoices yet"
              description="Consultation invoices appear at visit registration; other billable services can be added after the consultation."
            />
          ) : null}
          {invoicesQuery.data?.length ? (
            <ul className="divide-y divide-clinic-border">
              {invoicesQuery.data.map((invoice) => (
                <li key={invoice.id}>
                  <Link
                    to={`/app/billing/${invoice.id}`}
                    className="flex min-h-20 items-center justify-between gap-4 px-5 py-4 hover:bg-clinic-bg sm:px-6"
                  >
                    <div>
                      <p className="font-bold text-clinic-text">
                        {invoice.invoiceNumber} · {invoice.patientId?.fullName}
                      </p>
                      <p className="mt-1 text-sm text-clinic-muted">
                        {formatClinicDate(invoice.createdAt)} · Balance ₹
                        {invoice.balance.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={invoice.status} />
                      <IndianRupee aria-hidden="true" className="text-clinic-primary" size={18} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </>
  );
}
