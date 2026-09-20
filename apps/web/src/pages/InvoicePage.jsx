import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, CreditCard, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { paymentCreateSchema, PERMISSIONS } from '@clinicos/contracts';
import { ApiErrorNotice } from '../components/feedback/ApiErrorNotice.jsx';
import { FormField, inputClassName } from '../components/forms/FormField.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { InvoiceLetterhead } from '../components/billing/InvoiceLetterhead.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { collectPayment, getInvoice } from '../services/clinic.service.js';

export default function InvoicePage() {
  const { invoiceId } = useParams();
  const { user } = useAuth();
  const [paymentAttempt, setPaymentAttempt] = useState(null);
  const queryClient = useQueryClient();
  const invoiceQuery = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => getInvoice(invoiceId),
  });
  const form = useForm({
    resolver: zodResolver(paymentCreateSchema),
    defaultValues: { amount: 0, method: 'CASH', reference: '' },
  });
  const paymentMutation = useMutation({
    mutationFn: ({ values, key }) => collectPayment(invoiceId, values, key),
    onSuccess: (invoice) => {
      setPaymentAttempt(null);
      queryClient.setQueryData(['invoice', invoiceId], invoice);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      form.reset({ amount: invoice.balance, method: 'CASH', reference: '' });
    },
  });

  useEffect(() => {
    if (invoiceQuery.data && !form.formState.isDirty && !paymentMutation.isPending) {
      form.reset({ amount: invoiceQuery.data.balance, method: 'CASH', reference: '' });
    }
  }, [invoiceQuery.data, form, form.formState.isDirty, paymentMutation.isPending]);

  function submitPayment(values) {
    const fingerprint = JSON.stringify(values);
    const key =
      paymentAttempt?.fingerprint === fingerprint ? paymentAttempt.key : crypto.randomUUID();
    setPaymentAttempt({ fingerprint, key });
    paymentMutation.mutate({ values, key });
  }

  if (invoiceQuery.isLoading)
    return (
      <p className="rounded-2xl border border-clinic-border bg-clinic-surface p-10 text-center text-clinic-muted">
        Loading invoice…
      </p>
    );
  if (invoiceQuery.isError) return <ApiErrorNotice error={invoiceQuery.error} />;
  const invoice = invoiceQuery.data;
  const payable = invoice.balance > 0 && !['CANCELLED', 'REFUNDED'].includes(invoice.status);
  const canCollect = user.permissions.includes(PERMISSIONS.PAYMENT_COLLECT);
  const previsit = invoice.purpose === 'CONSULTATION';

  return (
    <>
      <div className="no-print">
        <PageHeader
          eyebrow="Invoice"
          title={invoice.invoiceNumber}
          description={`${invoice.patientId?.fullName} · ${formatClinicDateTime(invoice.createdAt)}`}
          actions={
            <>
              <Link
                to="/app/billing"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-clinic-border bg-clinic-surface px-4 text-sm font-bold text-clinic-text hover:bg-clinic-subtle"
              >
                <ArrowLeft aria-hidden="true" size={18} />
                Billing
              </Link>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-clinic-action px-4 text-sm font-bold text-white hover:bg-clinic-action-hover"
              >
                <Printer aria-hidden="true" size={18} />
                {invoice.status === 'PAID' ? 'Print receipt' : 'Print invoice'}
              </button>
            </>
          }
        />
      </div>
      {previsit ? (
        <div
          className={`no-print mb-5 rounded-xl border p-4 text-sm font-semibold ${invoice.status === 'PAID' ? 'border-clinic-accent/30 bg-clinic-accent-soft text-clinic-accent' : 'border-clinic-warning/30 bg-clinic-warning-soft text-clinic-warning'}`}
          role="status"
        >
          {invoice.status === 'PAID'
            ? 'Consultation fee paid. The patient is now in the doctor queue.'
            : 'Collect the full consultation fee before the patient joins the doctor queue.'}
          {invoice.status === 'PAID' ? (
            <Link to="/app/queue" className="ml-2 underline">
              Open queue
            </Link>
          ) : null}
        </div>
      ) : null}
      <div className="invoice-layout grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="invoice-document overflow-hidden rounded-2xl border border-clinic-border bg-clinic-surface shadow-card">
          <InvoiceLetterhead invoice={invoice} />
          <div className="invoice-table overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead className="bg-clinic-bg text-xs uppercase tracking-wide text-clinic-muted">
                <tr>
                  <th className="px-6 py-3">Item</th>
                  <th className="px-6 py-3 text-right">Qty</th>
                  <th className="px-6 py-3 text-right">Rate</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clinic-border">
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 font-semibold text-clinic-text">{item.description}</td>
                    <td className="px-6 py-4 text-right text-clinic-muted">{item.quantity}</td>
                    <td className="px-6 py-4 text-right text-clinic-muted">
                      ₹{item.rate.toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-clinic-text">
                      ₹{item.amount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="ml-auto max-w-sm space-y-2 border-t border-clinic-border p-5 sm:p-6">
            <div className="flex justify-between text-sm text-clinic-muted">
              <dt>Subtotal</dt>
              <dd>₹{invoice.subtotal.toLocaleString('en-IN')}</dd>
            </div>
            <div className="flex justify-between text-sm text-clinic-muted">
              <dt>Discount</dt>
              <dd>− ₹{invoice.discount.toLocaleString('en-IN')}</dd>
            </div>
            <div className="flex justify-between border-t border-clinic-border pt-2 text-lg font-bold text-clinic-text">
              <dt>Total</dt>
              <dd>₹{invoice.total.toLocaleString('en-IN')}</dd>
            </div>
            <div className="flex justify-between text-sm font-semibold text-clinic-accent">
              <dt>Paid</dt>
              <dd>₹{invoice.paidAmount.toLocaleString('en-IN')}</dd>
            </div>
            <div className="flex justify-between text-base font-bold text-clinic-danger">
              <dt>Balance</dt>
              <dd>₹{invoice.balance.toLocaleString('en-IN')}</dd>
            </div>
          </dl>
          <footer className="invoice-footer border-t border-clinic-border px-6 py-4 text-xs text-clinic-muted">
            Thank you for choosing Maitri Hospital &amp; Maternity Home. Please retain this document
            for your records.
          </footer>
        </section>
        <aside className="space-y-5">
          <section className="no-print rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card">
            <div className="flex items-center gap-3">
              <CreditCard aria-hidden="true" className="text-clinic-primary" size={22} />
              <h2 className="font-display text-lg font-semibold text-clinic-text">
                Collect payment
              </h2>
            </div>
            {payable && canCollect ? (
              <form className="mt-5 space-y-4" onSubmit={form.handleSubmit(submitPayment)}>
                <FormField
                  id="paymentAmount"
                  label="Amount ₹"
                  required
                  error={form.formState.errors.amount?.message}
                >
                  <input
                    id="paymentAmount"
                    type="number"
                    min="0.01"
                    max={invoice.balance}
                    step="0.01"
                    className={inputClassName}
                    {...form.register('amount', { valueAsNumber: true })}
                  />
                </FormField>
                <FormField id="paymentMethod" label="Method" required>
                  <select
                    id="paymentMethod"
                    className={inputClassName}
                    {...form.register('method')}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="OTHER">Other</option>
                  </select>
                </FormField>
                <FormField id="paymentReference" label="Reference">
                  <input
                    id="paymentReference"
                    className={inputClassName}
                    {...form.register('reference')}
                  />
                </FormField>
                {paymentMutation.isError ? <ApiErrorNotice error={paymentMutation.error} /> : null}
                <button
                  type="submit"
                  disabled={paymentMutation.isPending}
                  className="min-h-12 w-full rounded-xl bg-clinic-positive-action px-4 font-bold text-white hover:bg-clinic-positive-action-hover disabled:opacity-50"
                >
                  {paymentMutation.isPending ? 'Recording…' : 'Record payment'}
                </button>
              </form>
            ) : payable ? (
              <p className="mt-5 rounded-xl bg-clinic-warning-soft p-4 text-sm font-semibold text-clinic-warning">
                Payment is due. Ask an authorized reception or billing staff member to collect it.
              </p>
            ) : (
              <div className="mt-5 flex items-center gap-3 rounded-xl bg-clinic-accent-soft p-4 text-sm font-semibold text-clinic-accent">
                <CheckCircle2 aria-hidden="true" size={20} />
                No payment is due.
              </div>
            )}
          </section>
          <section className="invoice-payments rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card">
            <h2 className="font-display text-lg font-semibold text-clinic-text">Payment history</h2>
            {invoice.payments.length ? (
              <ul className="mt-4 divide-y divide-clinic-border">
                {invoice.payments.map((payment) => (
                  <li key={payment.id} className="py-3">
                    <div className="flex justify-between gap-3">
                      <span className="font-semibold text-clinic-text">
                        ₹{payment.amount.toLocaleString('en-IN')}
                      </span>
                      <span className="text-sm font-bold text-clinic-primary">
                        {payment.method.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-clinic-muted">
                      {formatClinicDateTime(payment.collectedAt)} · {payment.collectedBy?.name}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-clinic-muted">No payments recorded.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
import { formatClinicDateTime } from '../utils/format.js';
