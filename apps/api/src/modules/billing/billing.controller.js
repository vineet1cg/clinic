import { INVOICE_STATUSES, QUEUE_STATES, USER_ROLES, USER_STATUSES } from '@clinicos/contracts';
import { AppError } from '../../common/app-error.js';
import { getClinicId } from '../../common/clinic-context.js';
import { clinicDateRange } from '../../common/clinic-time.js';
import { nextSequence } from '../../models/counter.model.js';
import { Invoice } from '../../models/invoice.model.js';
import { Patient } from '../../models/patient.model.js';
import { QueueEntry } from '../../models/queue-entry.model.js';
import { User } from '../../models/user.model.js';
import { writeAuditEntry } from '../audit/audit.service.js';
import { runInTransaction } from '../../db/transaction.js';
import { enqueuePaymentReceiptNotification } from '../../queues/notification.service.js';
import { releasePaidConsultationVisit } from './consultation.service.js';

const invoicePopulation = [
  { path: 'patientId', select: 'patientNumber fullName mobile' },
  { path: 'doctorId', select: 'name' },
  { path: 'payments.collectedBy', select: 'name' },
];

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function assertMatchingPaymentReplay(payment, input) {
  if (
    payment.amount !== input.amount ||
    payment.method !== input.method ||
    (payment.reference || '') !== (input.reference || '')
  ) {
    throw new AppError({
      code: 'IDEMPOTENCY_KEY_CONFLICT',
      message: 'This payment key was already used with different payment details.',
      statusCode: 409,
    });
  }
}

export async function listInvoices(req, res) {
  const clinicId = getClinicId(req.user);
  const { status, patientId, queueEntryId, purpose, date } = req.validated.query;
  const filter = { clinicId };
  if (status) filter.status = status;
  if (patientId) filter.patientId = patientId;
  if (queueEntryId) filter.queueEntryId = queueEntryId;
  if (purpose) filter.purpose = purpose;
  if (date) {
    filter.createdAt = await clinicDateRange(clinicId, date, date);
  }
  const invoices = await Invoice.find(filter)
    .populate(invoicePopulation)
    .sort({ createdAt: -1 })
    .limit(500);
  res.json({ invoices });
}

export async function createInvoice(req, res) {
  const clinicId = getClinicId(req.user);
  const patient = await Patient.findOne({ _id: req.body.patientId, clinicId });
  if (!patient)
    throw new AppError({
      code: 'PATIENT_NOT_FOUND',
      message: 'Patient was not found.',
      statusCode: 404,
    });

  const [queueEntry, doctor] = await Promise.all([
    req.body.queueEntryId ? QueueEntry.findOne({ _id: req.body.queueEntryId, clinicId }) : null,
    req.body.doctorId
      ? User.findOne({
          _id: req.body.doctorId,
          clinicId,
          status: USER_STATUSES.ACTIVE,
          roles: { $in: [USER_ROLES.DOCTOR, USER_ROLES.SUPER_ADMIN] },
        })
      : null,
  ]);
  if (req.body.queueEntryId && !queueEntry) {
    throw new AppError({
      code: 'QUEUE_ENTRY_NOT_FOUND',
      message: 'Queue entry was not found.',
      statusCode: 404,
    });
  }
  if (queueEntry && queueEntry.patientId?.toString() !== patient.id) {
    throw new AppError({
      code: 'INVOICE_PATIENT_MISMATCH',
      message: 'The queue entry belongs to a different patient.',
      statusCode: 409,
    });
  }
  if (req.body.doctorId && !doctor) {
    throw new AppError({
      code: 'DOCTOR_NOT_FOUND',
      message: 'Select an active doctor.',
      statusCode: 404,
    });
  }
  if (queueEntry && doctor && queueEntry.doctorId?.toString() !== doctor.id) {
    throw new AppError({
      code: 'INVOICE_DOCTOR_MISMATCH',
      message: 'The selected doctor does not match the queue entry.',
      statusCode: 409,
    });
  }
  if (queueEntry?.state === QUEUE_STATES.PAYMENT_PENDING) {
    throw new AppError({
      code: 'CONSULTATION_FEE_UNPAID',
      message: 'Collect the consultation fee before adding other visit charges.',
      statusCode: 409,
    });
  }

  const items = req.body.items.map((item) => ({
    ...item,
    amount: money(item.quantity * item.rate),
  }));
  const subtotal = money(items.reduce((total, item) => total + item.amount, 0));
  if (req.body.discount > subtotal) {
    throw new AppError({
      code: 'INVALID_DISCOUNT',
      message: 'Discount cannot exceed the subtotal.',
      statusCode: 422,
    });
  }
  const total = money(subtotal - req.body.discount);
  const sequence = await nextSequence(`${clinicId}:invoice`);
  const invoice = await Invoice.create({
    ...req.body,
    clinicId,
    invoiceNumber: `INV${String(sequence).padStart(6, '0')}`,
    items,
    subtotal,
    total,
    balance: total,
    status: total === 0 ? INVOICE_STATUSES.PAID : INVOICE_STATUSES.UNPAID,
    createdBy: req.user._id,
  });

  if (queueEntry?.state === QUEUE_STATES.CONSULTATION_COMPLETE) {
    const previousState = queueEntry.state;
    queueEntry.transitions.push({
      from: previousState,
      to: QUEUE_STATES.BILLING_PENDING,
      actorId: req.user._id,
      at: new Date(),
    });
    if (total === 0) {
      queueEntry.transitions.push({
        from: QUEUE_STATES.BILLING_PENDING,
        to: QUEUE_STATES.PAID,
        actorId: req.user._id,
        at: new Date(),
      });
    }
    queueEntry.state = total === 0 ? QUEUE_STATES.PAID : QUEUE_STATES.BILLING_PENDING;
    if (total === 0) queueEntry.billingCompletedAt = new Date();
    await queueEntry.save();
  }

  await invoice.populate(invoicePopulation);
  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'invoice.create',
    resourceType: 'invoice',
    resourceId: invoice.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { total },
  });
  res.status(201).json({ invoice });
}

export async function getInvoice(req, res) {
  const invoice = await Invoice.findOne({
    _id: req.params.id,
    clinicId: getClinicId(req.user),
  }).populate(invoicePopulation);
  if (!invoice)
    throw new AppError({
      code: 'INVOICE_NOT_FOUND',
      message: 'Invoice was not found.',
      statusCode: 404,
    });
  res.json({ invoice });
}

export async function collectPayment(req, res) {
  const clinicId = getClinicId(req.user);
  const idempotencyKey = req.get('idempotency-key');
  if (!idempotencyKey || !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) {
    throw new AppError({
      code: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'A valid Idempotency-Key header is required when collecting payment.',
      statusCode: 400,
    });
  }
  const invoice = await Invoice.findOne({ _id: req.params.id, clinicId });
  if (!invoice)
    throw new AppError({
      code: 'INVOICE_NOT_FOUND',
      message: 'Invoice was not found.',
      statusCode: 404,
    });
  if ([INVOICE_STATUSES.CANCELLED, INVOICE_STATUSES.REFUNDED].includes(invoice.status)) {
    throw new AppError({
      code: 'INVOICE_NOT_PAYABLE',
      message: 'This invoice cannot accept payments.',
      statusCode: 409,
    });
  }
  const previousPayment = invoice.payments.find(
    (payment) => payment.idempotencyKey === idempotencyKey,
  );
  if (previousPayment) {
    assertMatchingPaymentReplay(previousPayment, req.body);
    await releasePaidConsultationVisit(invoice, req.user._id);
    await invoice.populate(invoicePopulation);
    return res.json({ invoice, idempotentReplay: true });
  }
  if (req.body.amount > invoice.balance) {
    throw new AppError({
      code: 'PAYMENT_EXCEEDS_BALANCE',
      message: 'Payment cannot exceed the outstanding balance.',
      statusCode: 422,
    });
  }

  await runInTransaction(async (session) => {
    invoice.payments.push({
      ...req.body,
      idempotencyKey,
      collectedBy: req.user._id,
      collectedAt: new Date(),
    });
    invoice.paidAmount = money(invoice.paidAmount + req.body.amount);
    invoice.balance = money(invoice.total - invoice.paidAmount);
    invoice.status = invoice.balance === 0 ? INVOICE_STATUSES.PAID : INVOICE_STATUSES.PARTIAL;

    try {
      await invoice.save(session ? { session } : {});
    } catch (error) {
      if (error?.name === 'VersionError' || error?.code === 11000) {
        const replay = await Invoice.findOne({
          _id: req.params.id,
          clinicId,
          'payments.idempotencyKey': idempotencyKey,
        });
        if (replay) {
          assertMatchingPaymentReplay(
            replay.payments.find((payment) => payment.idempotencyKey === idempotencyKey),
            req.body,
          );
          await releasePaidConsultationVisit(replay, req.user._id);
          await replay.populate(invoicePopulation);
          return res.json({ invoice: replay, idempotentReplay: true });
        }
      }
      throw error;
    }

    await releasePaidConsultationVisit(invoice, req.user._id);

    if (invoice.balance === 0 && invoice.queueEntryId) {
      const queueEntry = await QueueEntry.findOne({ _id: invoice.queueEntryId, clinicId });
      if (queueEntry?.state === QUEUE_STATES.BILLING_PENDING) {
        queueEntry.transitions.push({
          from: queueEntry.state,
          to: QUEUE_STATES.PAID,
          actorId: req.user._id,
          at: new Date(),
        });
        queueEntry.state = QUEUE_STATES.PAID;
        queueEntry.billingCompletedAt = new Date();
        await queueEntry.save(session ? { session } : {});
      }
    }
  });

  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'payment.collect',
    resourceType: 'invoice',
    resourceId: invoice.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { amount: req.body.amount, method: req.body.method },
  });

  const patient = await Patient.findOne({ _id: invoice.patientId, clinicId });
  if (patient) {
    enqueuePaymentReceiptNotification({
      clinicId,
      invoice,
      patient,
      payment: req.body,
    }).catch(() => {});
  }

  await invoice.populate(invoicePopulation);
  res.json({ invoice });
}

export async function voidInvoice(req, res) {
  const clinicId = getClinicId(req.user);
  const invoice = await Invoice.findOne({ _id: req.params.id, clinicId });
  if (!invoice) {
    throw new AppError({
      code: 'INVOICE_NOT_FOUND',
      message: 'Invoice was not found.',
      statusCode: 404,
    });
  }

  if (invoice.status === INVOICE_STATUSES.CANCELLED) {
    throw new AppError({
      code: 'INVOICE_ALREADY_CANCELLED',
      message: 'This invoice has already been voided/cancelled.',
      statusCode: 409,
    });
  }

  if (invoice.paidAmount > 0) {
    throw new AppError({
      code: 'PAID_INVOICE_CANNOT_BE_VOIDED',
      message: 'Invoices with recorded payments cannot be voided. Issue a refund instead.',
      statusCode: 409,
    });
  }

  await runInTransaction(async (session) => {
    invoice.status = INVOICE_STATUSES.CANCELLED;
    invoice.voidReason = req.body.reason;
    invoice.voidedAt = new Date();
    invoice.voidedBy = req.user._id;
    await invoice.save(session ? { session } : {});

    if (invoice.queueEntryId) {
      const queueEntry = await QueueEntry.findOne({ _id: invoice.queueEntryId, clinicId });
      if (queueEntry && queueEntry.state === QUEUE_STATES.PAYMENT_PENDING) {
        queueEntry.transitions.push({
          from: queueEntry.state,
          to: QUEUE_STATES.CANCELLED,
          actorId: req.user._id,
          at: new Date(),
        });
        queueEntry.state = QUEUE_STATES.CANCELLED;
        await queueEntry.save(session ? { session } : {});
      }
    }
  });

  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'invoice.void',
    resourceType: 'invoice',
    resourceId: invoice.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { reason: req.body.reason, invoiceNumber: invoice.invoiceNumber },
  });

  await invoice.populate(invoicePopulation);
  res.json({ invoice });
}

export async function refundInvoice(req, res) {
  const clinicId = getClinicId(req.user);
  const { amount, reason, method, reference } = req.body;
  const invoice = await Invoice.findOne({ _id: req.params.id, clinicId });
  if (!invoice) {
    throw new AppError({
      code: 'INVOICE_NOT_FOUND',
      message: 'Invoice was not found.',
      statusCode: 404,
    });
  }

  if (invoice.status === INVOICE_STATUSES.CANCELLED) {
    throw new AppError({
      code: 'INVOICE_CANCELLED',
      message: 'A voided or cancelled invoice cannot be refunded.',
      statusCode: 409,
    });
  }

  const refundable = money(invoice.paidAmount - (invoice.refundedAmount || 0));
  if (refundable <= 0) {
    throw new AppError({
      code: 'NO_REFUNDABLE_BALANCE',
      message: 'This invoice has no paid balance available to refund.',
      statusCode: 409,
    });
  }

  if (amount > refundable) {
    throw new AppError({
      code: 'REFUND_EXCEEDS_PAID',
      message: `Refund amount of ₹${amount} exceeds the refundable balance of ₹${refundable}.`,
      statusCode: 422,
    });
  }

  await runInTransaction(async (session) => {
    invoice.refunds.push({
      amount,
      reason,
      method: method || 'CASH',
      reference,
      refundedBy: req.user._id,
      refundedAt: new Date(),
    });

    invoice.refundedAmount = money((invoice.refundedAmount || 0) + amount);
    if (invoice.refundedAmount >= invoice.paidAmount) {
      invoice.status = INVOICE_STATUSES.REFUNDED;
    }
    await invoice.save(session ? { session } : {});
  });

  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'payment.refund',
    resourceType: 'invoice',
    resourceId: invoice.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { amount, reason, method, invoiceNumber: invoice.invoiceNumber },
  });

  await invoice.populate(invoicePopulation);
  res.json({ invoice });
}
