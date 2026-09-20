import { PERMISSIONS, QUEUE_STATES } from '@clinicos/contracts';
import { AppError } from '../../common/app-error.js';
import { getClinicId } from '../../common/clinic-context.js';
import { clinicToday } from '../../common/clinic-time.js';
import { serializeQueueEntry } from '../../common/response-privacy.js';
import { env } from '../../config/env.js';
import { QueueEntry } from '../../models/queue-entry.model.js';
import { Invoice } from '../../models/invoice.model.js';
import { writeAuditEntry } from '../audit/audit.service.js';
import { resolvePermissions } from '../auth/auth.service.js';
import {
  assertConsultationPaid,
  ensureConsultationInvoice,
  registerConsultationVisit,
} from '../billing/consultation.service.js';
import { assertQueueTransition } from './queue-state.service.js';

const populateQueue = [
  { path: 'patientId', select: 'patientNumber fullName mobile gender dateOfBirth age' },
  { path: 'doctorId', select: 'name roles' },
  { path: 'appointmentId', select: 'appointmentNumber time visitType' },
];

export async function publicQueueDisplay(req, res) {
  const clinicId = env.DEFAULT_CLINIC_ID;
  const date = await clinicToday(clinicId);
  const filter = { clinicId, queueDate: date };
  if (req.params.doctorId !== 'main') filter.doctorId = req.params.doctorId;
  const entries = await QueueEntry.find(filter)
    .select('doctorId tokenNumber state priority consultationStartedAt checkInAt')
    .populate('doctorId', 'name')
    .sort({ priority: -1, tokenNumber: 1 });
  const consulting = entries.filter((entry) => entry.state === QUEUE_STATES.IN_CONSULTATION);
  const waitingStates = [
    QUEUE_STATES.WAITING,
    QUEUE_STATES.VITALS_PENDING,
    QUEUE_STATES.VITALS_COMPLETE,
    QUEUE_STATES.READY_FOR_DOCTOR,
  ];
  res.json({
    date,
    nowConsulting: consulting.map((entry) => ({
      tokenNumber: entry.tokenNumber,
      doctorName: entry.doctorId?.name || 'Doctor',
    })),
    waiting: entries
      .filter((entry) => waitingStates.includes(entry.state))
      .map((entry) => ({
        tokenNumber: entry.tokenNumber,
        doctorName: entry.doctorId?.name || 'Doctor',
        state: entry.state,
      })),
  });
}

export async function listQueue(req, res) {
  const clinicId = getClinicId(req.user);
  const { doctorId, state } = req.validated.query;
  const date = req.validated.query.date || (await clinicToday(clinicId));
  const filter = { clinicId, queueDate: date };
  if (doctorId) filter.doctorId = doctorId;
  const canViewBilling = resolvePermissions(req.user).includes(PERMISSIONS.BILLING_VIEW);
  if (canViewBilling) {
    if (state) filter.state = state;
  } else {
    filter.state =
      state === QUEUE_STATES.PAYMENT_PENDING
        ? { $in: [] }
        : state || { $ne: QUEUE_STATES.PAYMENT_PENDING };
  }
  const queue = await QueueEntry.find(filter)
    .populate(populateQueue)
    .sort({ priority: -1, tokenNumber: 1 });
  res.json({ queue: queue.map((entry) => serializeQueueEntry(entry, req.user)), date });
}

export async function getQueueEntry(req, res) {
  const entry = await QueueEntry.findOne({
    _id: req.params.id,
    clinicId: getClinicId(req.user),
  }).populate(populateQueue);
  if (!entry) {
    throw new AppError({
      code: 'QUEUE_ENTRY_NOT_FOUND',
      message: 'Queue entry was not found.',
      statusCode: 404,
    });
  }
  if (
    entry.state === QUEUE_STATES.PAYMENT_PENDING &&
    !resolvePermissions(req.user).includes(PERMISSIONS.BILLING_VIEW)
  ) {
    throw new AppError({
      code: 'QUEUE_ENTRY_NOT_FOUND',
      message: 'Queue entry was not found.',
      statusCode: 404,
    });
  }
  res.json({ queueEntry: serializeQueueEntry(entry, req.user) });
}

export async function createWalkIn(req, res) {
  const clinicId = getClinicId(req.user);
  const registrationKey = req.get('idempotency-key');
  if (!registrationKey || !/^[A-Za-z0-9._:-]{16,128}$/.test(registrationKey)) {
    throw new AppError({
      code: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'A valid Idempotency-Key header is required to register a walk-in.',
      statusCode: 400,
    });
  }
  const { queueEntry: entry, invoice } = await registerConsultationVisit({
    clinicId,
    actorId: req.user._id,
    ...req.body,
    registrationKey,
    requestContext: { ipAddress: req.ip, userAgent: req.get('user-agent') },
  });
  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'queue.walk_in_created',
    resourceType: 'queue_entry',
    resourceId: entry.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  await entry.populate(populateQueue);
  res.status(201).json({
    queueEntry: serializeQueueEntry(entry, req.user),
    consultationInvoice: invoice,
  });
}

export async function recoverConsultationInvoice(req, res) {
  const clinicId = getClinicId(req.user);
  const entry = await QueueEntry.findOne({ _id: req.params.id, clinicId });
  if (!entry) {
    throw new AppError({
      code: 'QUEUE_ENTRY_NOT_FOUND',
      message: 'Queue entry was not found.',
      statusCode: 404,
    });
  }
  const invoice = await ensureConsultationInvoice({
    queueEntry: entry,
    doctor: await entry.populate({ path: 'doctorId', select: 'name' }).then(() => entry.doctorId),
    actorId: req.user._id,
    requestContext: { ipAddress: req.ip, userAgent: req.get('user-agent') },
  });
  res.json({ consultationInvoice: invoice });
}

function transitionTimestamps(state) {
  const fieldByState = {
    [QUEUE_STATES.VITALS_PENDING]: 'vitalsStartedAt',
    [QUEUE_STATES.VITALS_COMPLETE]: 'vitalsCompletedAt',
    [QUEUE_STATES.IN_CONSULTATION]: 'consultationStartedAt',
    [QUEUE_STATES.CONSULTATION_COMPLETE]: 'consultationCompletedAt',
    [QUEUE_STATES.PAID]: 'billingCompletedAt',
    [QUEUE_STATES.COMPLETED]: 'completedAt',
  };
  return fieldByState[state] ? { [fieldByState[state]]: new Date() } : {};
}

export async function transitionQueueEntry(req, res) {
  const clinicId = getClinicId(req.user);
  const entry = await QueueEntry.findOne({ _id: req.params.id, clinicId });
  if (!entry) {
    throw new AppError({
      code: 'QUEUE_ENTRY_NOT_FOUND',
      message: 'Queue entry was not found.',
      statusCode: 404,
    });
  }

  assertQueueTransition(entry.state, req.body.state);
  if (
    entry.state === QUEUE_STATES.PAYMENT_PENDING &&
    !resolvePermissions(req.user).includes(PERMISSIONS.BILLING_VIEW)
  ) {
    throw new AppError({
      code: 'FORBIDDEN',
      message: 'Only reception or billing staff can cancel a fee-pending visit.',
      statusCode: 403,
    });
  }
  if (req.body.state !== QUEUE_STATES.CANCELLED) {
    await assertConsultationPaid(entry);
  } else if (entry.state === QUEUE_STATES.PAYMENT_PENDING && entry.consultationInvoiceId) {
    const cancelledInvoice = await Invoice.findOneAndUpdate(
      {
        _id: entry.consultationInvoiceId,
        clinicId,
        purpose: 'CONSULTATION',
        status: 'UNPAID',
        paidAmount: 0,
      },
      {
        $set: { status: 'CANCELLED' },
        $inc: { __v: 1 },
      },
      { returnDocument: 'after' },
    );
    if (!cancelledInvoice) {
      const invoice = await Invoice.findOne({
        _id: entry.consultationInvoiceId,
        clinicId,
        purpose: 'CONSULTATION',
      });
      if (invoice && invoice.status !== 'CANCELLED') {
        throw new AppError({
          code: 'PAID_VISIT_CANNOT_CANCEL',
          message: 'A paid or partially paid visit needs a refund before cancellation.',
          statusCode: 409,
        });
      }
    } else {
      await writeAuditEntry({
        clinicId,
        actorId: req.user._id,
        action: 'invoice.cancel',
        resourceType: 'invoice',
        resourceId: cancelledInvoice.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { reason: 'visit_cancelled_before_payment' },
      });
    }
  }
  const previousState = entry.state;
  entry.state = req.body.state;
  Object.assign(entry, transitionTimestamps(entry.state));
  entry.transitions.push({
    from: previousState,
    to: entry.state,
    actorId: req.user._id,
    reason: req.body.reason,
    at: new Date(),
  });
  await entry.save();

  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'queue.state_changed',
    resourceType: 'queue_entry',
    resourceId: entry.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { from: previousState, to: entry.state, reason: req.body.reason },
  });
  await entry.populate(populateQueue);
  res.json({ queueEntry: serializeQueueEntry(entry, req.user) });
}
