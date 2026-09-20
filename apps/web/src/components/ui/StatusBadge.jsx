const tones = {
  neutral: 'bg-clinic-subtle text-clinic-muted',
  primary: 'bg-clinic-primary-soft text-clinic-primary',
  success: 'bg-clinic-accent-soft text-clinic-accent',
  warning: 'bg-clinic-warning-soft text-clinic-warning',
  danger: 'bg-clinic-danger-soft text-clinic-danger',
  info: 'bg-clinic-info-soft text-clinic-info',
  violet: 'bg-clinic-violet-soft text-clinic-violet',
  orange: 'bg-clinic-orange-soft text-clinic-orange',
};

const statusConfig = {
  REGISTERED: ['Registered', 'neutral'],
  PAYMENT_PENDING: ['Fee due', 'danger'],
  WAITING: ['Waiting', 'warning'],
  VITALS_PENDING: ['Vitals pending', 'orange'],
  VITALS_COMPLETE: ['Vitals complete', 'primary'],
  READY_FOR_DOCTOR: ['Ready for doctor', 'primary'],
  IN_CONSULTATION: ['In consultation', 'info'],
  CONSULTATION_COMPLETE: ['Consultation complete', 'violet'],
  BILLING_PENDING: ['Billing pending', 'warning'],
  PAID: ['Paid', 'success'],
  COMPLETED: ['Completed', 'success'],
  NO_SHOW: ['No-show', 'neutral'],
  CANCELLED: ['Cancelled', 'danger'],
  ON_HOLD: ['On hold', 'violet'],
  REFERRED: ['Referred', 'violet'],
  LAB_PENDING: ['Lab pending', 'violet'],
  PHARMACY_PENDING: ['Pharmacy pending', 'primary'],
  SCHEDULED: ['Scheduled', 'info'],
  CHECKED_IN: ['Checked in', 'primary'],
  DRAFT: ['Draft', 'neutral'],
  UNPAID: ['Unpaid', 'danger'],
  PARTIAL: ['Partially paid', 'warning'],
  REFUNDED: ['Refunded', 'neutral'],
  ORDERED: ['Ordered', 'info'],
  SAMPLE_PENDING: ['Sample pending', 'warning'],
  SAMPLE_COLLECTED: ['Sample collected', 'primary'],
  PROCESSING: ['Processing', 'info'],
  RESULT_READY: ['Result ready', 'primary'],
  VERIFIED: ['Verified', 'success'],
  ACTIVE: ['Active', 'success'],
  INACTIVE: ['Inactive', 'neutral'],
  LOCKED: ['Locked', 'danger'],
  PASSWORD_RESET_REQUIRED: ['Password change required', 'warning'],
};

export function StatusBadge({ status }) {
  const [label, tone] = statusConfig[status] || [
    String(status || 'Unknown').replaceAll('_', ' '),
    'neutral',
  ];

  return (
    <span
      data-status={status}
      className={`inline-flex min-h-7 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {label}
    </span>
  );
}
