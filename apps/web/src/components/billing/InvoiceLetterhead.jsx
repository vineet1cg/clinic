import { CLINIC_BRAND } from '../../constants/branding.js';
import { StatusBadge } from '../ui/StatusBadge.jsx';

export function InvoiceLetterhead({ invoice }) {
  return (
    <header className="invoice-letterhead border-b-4 border-clinic-primary p-5 sm:p-6">
      <div className="flex items-center gap-4">
        <img
          src={CLINIC_BRAND.logo}
          alt="Maitri mother and child emblem"
          width="827"
          height="1024"
          className="clinic-logo h-24 w-20 shrink-0 rounded-lg object-contain p-2"
        />
        <div className="min-w-0">
          <p className="font-display text-3xl font-bold tracking-wide text-clinic-primary">
            MAITRI
          </p>
          <p className="text-sm font-semibold text-clinic-text">{CLINIC_BRAND.descriptor}</p>
          <p className="mt-2 text-xs text-clinic-muted">
            {invoice.purpose === 'CONSULTATION' ? 'Consultation fees' : 'Clinic services'}
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-3 border-t border-clinic-border pt-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-clinic-text">
            {invoice.status === 'PAID' ? 'Payment receipt' : 'Invoice'} · {invoice.invoiceNumber}
          </h2>
          <p className="mt-1 text-sm text-clinic-muted">
            Issued {formatClinicDateTime(invoice.createdAt)}
          </p>
        </div>
        <StatusBadge status={invoice.status} />
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-clinic-muted">Patient</dt>
          <dd className="break-words font-semibold text-clinic-text">
            {invoice.patientId?.fullName || '—'}
          </dd>
        </div>
        <div>
          <dt className="text-clinic-muted">Patient ID</dt>
          <dd className="font-semibold text-clinic-text">
            {invoice.patientId?.patientNumber || '—'}
          </dd>
        </div>
        {invoice.doctorId?.name ? (
          <div>
            <dt className="text-clinic-muted">Doctor</dt>
            <dd className="font-semibold text-clinic-text">{invoice.doctorId.name}</dd>
          </div>
        ) : null}
      </dl>
    </header>
  );
}
import { formatClinicDateTime } from '../../utils/format.js';
