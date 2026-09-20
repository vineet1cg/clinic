import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PAYMENT_METHODS, PERMISSIONS } from '@clinicos/contracts';
import { useAuth } from '../../hooks/useAuth.js';
import { collectPayment } from '../../services/clinic.service.js';
import { ApiErrorNotice } from '../feedback/ApiErrorNotice.jsx';
import { FormField, inputClassName } from '../forms/FormField.jsx';

// The visit is created first and remains PAYMENT_PENDING until the server confirms full payment.
export function ConsultationPayment({ invoice: initialInvoice, onClose }) {
  const { user } = useAuth();
  const [invoice, setInvoice] = useState(initialInvoice);
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const attempt = useRef(null);
  const inFlight = useRef(false);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ values, key }) => collectPayment(invoice.id, values, key),
    onSuccess: (saved) => {
      setInvoice(saved);
      attempt.current = null;
      queryClient.setQueryData(['invoice', saved.id], saved);
      for (const key of ['queue', 'appointments', 'invoices', 'dashboard'])
        queryClient.invalidateQueries({ queryKey: [key] });
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });
  const payable = invoice.balance > 0 && !['CANCELLED', 'REFUNDED'].includes(invoice.status);
  function submit(event) {
    event.preventDefault();
    if (inFlight.current || !payable) return;
    const values = { amount: invoice.balance, method, reference: reference.trim() };
    const fingerprint = JSON.stringify(values);
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    inFlight.current = true;
    mutation.mutate({ values, key: attempt.current.key });
  }
  return (
    <section
      className="mb-5 rounded-2xl border border-clinic-primary bg-clinic-surface p-5 shadow-card"
      aria-labelledby="consultation-payment-title"
    >
      <h2
        id="consultation-payment-title"
        className="font-display text-xl font-semibold text-clinic-text"
      >
        Consultation payment · {invoice.invoiceNumber}
      </h2>
      <p className="mt-2 text-sm text-clinic-muted">
        {invoice.patientId?.fullName ? `${invoice.patientId.fullName} · ` : ''}Balance: ₹
        {invoice.balance.toLocaleString('en-IN')}
      </p>
      {invoice.status === 'PAID' ? (
        <p
          role="status"
          className="mt-4 rounded-xl bg-clinic-accent-soft p-3 font-semibold text-clinic-accent"
        >
          Consultation fee paid. The patient is eligible for the doctor queue.
        </p>
      ) : payable ? (
        <p className="mt-3 text-sm text-clinic-warning">
          Visit registered. The patient stays out of the doctor queue until the full fee is
          recorded.
        </p>
      ) : (
        <p className="mt-3 text-clinic-warning">This invoice cannot accept payment.</p>
      )}
      {payable && user.permissions.includes(PERMISSIONS.PAYMENT_COLLECT) ? (
        <form className="mt-4 space-y-4" onSubmit={submit}>
          <fieldset disabled={mutation.isPending} className="grid gap-4 sm:grid-cols-2">
            <FormField id="consultation-method" label="Payment method">
              <select
                id="consultation-method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className={inputClassName}
              >
                {PAYMENT_METHODS.map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="consultation-reference" label="Payment reference (optional)">
              <input
                id="consultation-reference"
                value={reference}
                maxLength={120}
                onChange={(e) => setReference(e.target.value)}
                className={inputClassName}
              />
            </FormField>
          </fieldset>
          <p className="text-xs text-clinic-muted">
            Record only money actually received. Card/UPI entries do not verify provider settlement.
          </p>
          {mutation.isError ? <ApiErrorNotice error={mutation.error} /> : null}
          <button
            disabled={mutation.isPending}
            className="min-h-12 rounded-xl bg-clinic-positive-action px-5 font-bold text-white disabled:opacity-50"
            type="submit"
          >
            {mutation.isPending
              ? 'Recording payment…'
              : `Record ₹${invoice.balance.toLocaleString('en-IN')} and release to queue`}
          </button>
        </form>
      ) : payable ? (
        <p className="mt-3 text-clinic-warning">
          Ask authorized billing staff to collect this fee.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-4">
        <Link
          className="inline-flex min-h-11 items-center font-semibold text-clinic-primary underline"
          to={`/app/billing/${invoice.id}`}
        >
          Open invoice / print receipt
        </Link>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={onClose}
          className="min-h-11 font-semibold text-clinic-muted underline"
        >
          {invoice.status === 'PAID' ? 'Done' : 'Collect later — keep payment pending'}
        </button>
      </div>
    </section>
  );
}
