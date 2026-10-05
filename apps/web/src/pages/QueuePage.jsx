import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowRight, Monitor, Plus, Stethoscope } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PERMISSIONS, QUEUE_STATES } from '@clinicos/contracts';
import { ApiErrorNotice } from '../components/feedback/ApiErrorNotice.jsx';
import { EmptyState } from '../components/feedback/EmptyState.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { useAuth } from '../hooks/useAuth.js';
import {
  listQueue,
  recoverConsultationInvoice,
  transitionQueue,
} from '../services/clinic.service.js';

const flow = [
  'PAYMENT_PENDING',
  'WAITING',
  'VITALS_PENDING',
  'VITALS_COMPLETE',
  'READY_FOR_DOCTOR',
  'IN_CONSULTATION',
  'CONSULTATION_COMPLETE',
  'BILLING_PENDING',
  'PAID',
  'COMPLETED',
];

const nextAction = {
  WAITING: { state: QUEUE_STATES.READY_FOR_DOCTOR, label: 'Ready for doctor' },
  VITALS_PENDING: { state: QUEUE_STATES.VITALS_COMPLETE, label: 'Vitals complete' },
  VITALS_COMPLETE: { state: QUEUE_STATES.READY_FOR_DOCTOR, label: 'Ready for doctor' },
  PAID: { state: QUEUE_STATES.COMPLETED, label: 'Complete visit' },
  ON_HOLD: { state: QUEUE_STATES.WAITING, label: 'Resume waiting' },
};

function minutesSince(value) {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
}

function queueDetail(entry) {
  if (entry.state === QUEUE_STATES.PAYMENT_PENDING)
    return `₹${entry.consultationFee?.toLocaleString('en-IN') || '—'} due before queue`;
  if (entry.state === QUEUE_STATES.CONSULTATION_COMPLETE)
    return 'consultation complete · reception action required';
  if (entry.state === QUEUE_STATES.BILLING_PENDING) return 'reception billing in progress';
  if (entry.state === QUEUE_STATES.PAID) return 'billing complete · ready to close';
  if (entry.state === QUEUE_STATES.COMPLETED) return 'visit complete';
  return `waiting ${minutesSince(entry.checkInAt)} min`;
}

export default function QueuePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const queueQuery = useQuery({
    queryKey: ['queue', 'today'],
    queryFn: () => listQueue(),
    refetchInterval: 10_000,
  });
  const transitionMutation = useMutation({
    mutationFn: ({ id, state, reason }) => transitionQueue(id, state, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue'] }),
  });
  const recoverInvoiceMutation = useMutation({
    mutationFn: recoverConsultationInvoice,
    onSuccess: (invoice) => navigate(`/app/billing/${invoice.id}`),
  });
  const queue = queueQuery.data || [];
  const feeDue = queue.filter((entry) => entry.state === 'PAYMENT_PENDING').length;
  const waiting = queue.filter((entry) =>
    ['WAITING', 'VITALS_PENDING', 'VITALS_COMPLETE', 'READY_FOR_DOCTOR'].includes(entry.state),
  ).length;
  const consulting = queue.filter((entry) => entry.state === 'IN_CONSULTATION').length;
  const awaitingReception = queue.filter((entry) => entry.state === 'CONSULTATION_COMPLETE').length;
  const completed = queue.filter((entry) => entry.state === 'COMPLETED').length;
  const canManageQueue = user.permissions.includes(PERMISSIONS.QUEUE_MANAGE);
  const canOpenConsultation = user.permissions.includes(PERMISSIONS.ENCOUNTER_VIEW);
  const canCreateBilling = user.permissions.includes(PERMISSIONS.BILLING_CREATE);

  return (
    <>
      <PageHeader
        eyebrow="Today’s flow"
        title="Patient queue"
        description="Registration holds a place in today's flow. The doctor queue begins only after the consultation fee is paid."
        actions={
          <>
            <Link
              to="/display/main"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-clinic-border bg-clinic-surface px-4 text-sm font-bold text-clinic-text hover:bg-clinic-subtle"
            >
              <Monitor aria-hidden="true" size={18} />
              Waiting-room view
            </Link>
            {canManageQueue ? (
              <Link
                to="/app/appointments?mode=walk-in"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-clinic-action px-4 text-sm font-bold text-white hover:bg-clinic-action-hover"
              >
                <Plus aria-hidden="true" size={18} />
                Add walk-in
              </Link>
            ) : null}
          </>
        }
      />

      <section
        aria-labelledby="queue-stages"
        className="rounded-2xl border border-clinic-border bg-clinic-surface p-4 shadow-card sm:p-5"
      >
        <h2 id="queue-stages" className="text-sm font-semibold text-clinic-text">
          Queue stages
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {flow.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-clinic-border bg-clinic-surface shadow-card">
        <div className="border-b border-clinic-border px-5 py-4 sm:px-6">
          <h2 className="font-display text-lg font-semibold text-clinic-text">All doctors</h2>
          <p className="mt-1 text-sm text-clinic-muted">
            {feeDue} fee due · {waiting} waiting · {consulting} in consultation ·{' '}
            {awaitingReception} awaiting reception · {completed} completed
          </p>
        </div>
        {queueQuery.isError ? (
          <div className="p-5">
            <ApiErrorNotice error={queueQuery.error} />
          </div>
        ) : null}
        {transitionMutation.isError ? (
          <div className="p-5">
            <ApiErrorNotice error={transitionMutation.error} />
          </div>
        ) : null}
        {recoverInvoiceMutation.isError ? (
          <div className="p-5">
            <ApiErrorNotice error={recoverInvoiceMutation.error} />
          </div>
        ) : null}
        {queueQuery.isLoading ? (
          <p className="p-10 text-center text-sm text-clinic-muted">Loading today’s queue…</p>
        ) : null}
        {!queueQuery.isLoading && !queue.length ? (
          <EmptyState
            icon={Activity}
            title="No patients in today’s queue"
            description="Check in an appointment or add a walk-in to issue the first token."
          />
        ) : null}
        {queue.length ? (
          <ul className="divide-y divide-clinic-border">
            {queue.map((entry) => {
              const action = canManageQueue ? nextAction[entry.state] : null;
              const isConsultation = ['READY_FOR_DOCTOR', 'IN_CONSULTATION'].includes(entry.state);
              return (
                <li key={entry.id} className="px-4 py-4 sm:px-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-clinic-action text-lg font-black text-white">
                        {entry.tokenNumber}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/app/patients/${entry.patientId?.id}`}
                            className="truncate font-bold text-clinic-text hover:text-clinic-primary"
                          >
                            {entry.patientId?.fullName}
                          </Link>
                          {entry.priority >= 50 ? (
                            <span className="rounded-full bg-clinic-danger-soft px-2 py-1 text-xs font-bold text-clinic-danger">
                              {entry.priority === 100 ? 'Emergency' : 'Urgent'}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-clinic-muted">
                          Dr. {entry.doctorId?.name} · {queueDetail(entry)}
                          {entry.reason ? ` · ${entry.reason}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={entry.state} />
                      {entry.state === 'PAYMENT_PENDING' ? (
                        entry.consultationInvoiceId ? (
                          <Link
                            to={`/app/billing/${entry.consultationInvoiceId}`}
                            className="inline-flex min-h-11 items-center rounded-xl bg-clinic-action px-3 text-sm font-bold text-white hover:bg-clinic-action-hover"
                          >
                            Collect fee
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => recoverInvoiceMutation.mutate(entry.id)}
                            disabled={recoverInvoiceMutation.isPending}
                            className="inline-flex min-h-11 items-center rounded-xl bg-clinic-action px-3 text-sm font-bold text-white disabled:opacity-50"
                          >
                            Open fee invoice
                          </button>
                        )
                      ) : null}
                      {entry.state === 'WAITING' && canManageQueue ? (
                        <button
                          type="button"
                          onClick={() =>
                            transitionMutation.mutate({
                              id: entry.id,
                              state: QUEUE_STATES.VITALS_PENDING,
                            })
                          }
                          className="min-h-11 rounded-xl border border-clinic-border px-3 text-sm font-bold text-clinic-text hover:bg-clinic-subtle"
                        >
                          Start vitals
                        </button>
                      ) : null}
                      {action ? (
                        <button
                          type="button"
                          onClick={() =>
                            transitionMutation.mutate({ id: entry.id, state: action.state })
                          }
                          disabled={transitionMutation.isPending}
                          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-clinic-primary px-3 text-sm font-bold text-clinic-primary hover:bg-clinic-primary-soft disabled:opacity-50"
                        >
                          {action.label}
                          <ArrowRight aria-hidden="true" size={16} />
                        </button>
                      ) : null}
                      {isConsultation && canOpenConsultation ? (
                        <Link
                          to={`/app/consultation/${entry.id}`}
                          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-clinic-action px-3 text-sm font-bold text-white hover:bg-clinic-action-hover"
                        >
                          <Stethoscope aria-hidden="true" size={17} />
                          {entry.state === 'READY_FOR_DOCTOR' ? 'Start' : 'Open'}
                        </Link>
                      ) : null}
                      {['CONSULTATION_COMPLETE', 'BILLING_PENDING'].includes(entry.state) &&
                      canCreateBilling ? (
                        <Link
                          to={`/app/billing?patientId=${entry.patientId?.id}&queueEntryId=${entry.id}&doctorId=${entry.doctorId?.id || entry.doctorId?._id || ''}`}
                          className="inline-flex min-h-11 items-center rounded-xl bg-clinic-action px-3 text-sm font-bold text-white"
                        >
                          {entry.state === 'CONSULTATION_COMPLETE'
                            ? 'Prepare final bill'
                            : 'Continue billing'}
                        </Link>
                      ) : null}
                      {entry.state === 'CONSULTATION_COMPLETE' && canManageQueue ? (
                        <button
                          type="button"
                          onClick={() =>
                            transitionMutation.mutate({
                              id: entry.id,
                              state: QUEUE_STATES.COMPLETED,
                              reason: 'No additional charges after consultation',
                            })
                          }
                          disabled={transitionMutation.isPending}
                          className="inline-flex min-h-11 items-center rounded-xl border border-clinic-border px-3 text-sm font-bold text-clinic-text hover:bg-clinic-subtle disabled:opacity-50"
                        >
                          Close — no extra charges
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </>
  );
}
