import { INVOICE_STATUSES, QUEUE_STATES, USER_ROLES, USER_STATUSES } from '@clinicos/contracts';
import { AppError } from '../../common/app-error.js';
import { ClinicSettings } from '../../models/clinic-settings.model.js';
import { nextSequence } from '../../models/counter.model.js';
import { Invoice } from '../../models/invoice.model.js';
import { QueueEntry } from '../../models/queue-entry.model.js';
import { User } from '../../models/user.model.js';
import { writeAuditEntry } from '../audit/audit.service.js';
import { createQueueEntry } from '../queue/queue.service.js';

export function resolveConsultationFee(doctor, settings) {
  return doctor.consultationFee > 0
    ? doctor.consultationFee
    : (settings?.defaultConsultationFee ?? 0);
}

export async function assertConsultationPaid(queueEntry) {
  if (!queueEntry.paymentRequired) return;
  const paid = queueEntry.consultationInvoiceId
    ? await Invoice.exists({
        _id: queueEntry.consultationInvoiceId,
        clinicId: queueEntry.clinicId,
        queueEntryId: queueEntry._id,
        purpose: 'CONSULTATION',
        status: INVOICE_STATUSES.PAID,
        balance: 0,
      })
    : false;
  if (!paid) {
    throw new AppError({
      code: 'CONSULTATION_FEE_UNPAID',
      message: 'Collect the full consultation fee before moving the patient to the doctor queue.',
      statusCode: 409,
    });
  }
}

export async function registerConsultationVisit({
  clinicId,
  actorId,
  patientId,
  doctorId,
  reason,
  priority,
  appointment,
  queueDate,
  registrationKey,
  requestContext,
}) {
  const [doctor, settings] = await Promise.all([
    User.findOne({
      _id: doctorId,
      clinicId,
      status: USER_STATUSES.ACTIVE,
      roles: { $in: [USER_ROLES.DOCTOR, USER_ROLES.SUPER_ADMIN] },
    }),
    ClinicSettings.findOne({ clinicId }).select('defaultConsultationFee'),
  ]);
  if (!doctor) {
    throw new AppError({
      code: 'DOCTOR_NOT_FOUND',
      message: 'Select an active doctor.',
      statusCode: 404,
    });
  }
  const consultationFee = resolveConsultationFee(doctor, settings);
  const queueEntry = await createQueueEntry({
    clinicId,
    actorId,
    patientId,
    doctorId,
    reason,
    priority,
    appointment,
    queueDate,
    registrationKey,
    consultationFee,
  });

  // Legacy visits created before this workflow have no previsit charge.
  if (!queueEntry.paymentRequired) return { queueEntry, invoice: null };
  const invoice = await ensureConsultationInvoice({ queueEntry, doctor, actorId, requestContext });
  return { queueEntry, invoice };
}

export async function ensureConsultationInvoice({ queueEntry, doctor, actorId, requestContext }) {
  if (!queueEntry.paymentRequired || !queueEntry.consultationFee) {
    throw new AppError({
      code: 'CONSULTATION_INVOICE_NOT_APPLICABLE',
      message: 'This visit has no consultation charge to recover.',
      statusCode: 409,
    });
  }
  if (queueEntry.state === QUEUE_STATES.CANCELLED) {
    throw new AppError({
      code: 'VISIT_CANCELLED',
      message: 'A cancelled visit cannot be billed.',
      statusCode: 409,
    });
  }
  const clinicId = queueEntry.clinicId;
  let invoice = await Invoice.findOne({
    clinicId,
    queueEntryId: queueEntry._id,
    purpose: 'CONSULTATION',
  });
  if (!invoice) {
    const sequence = await nextSequence(`${clinicId}:invoice`);
    try {
      invoice = await Invoice.create({
        clinicId,
        invoiceNumber: `INV${String(sequence).padStart(6, '0')}`,
        purpose: 'CONSULTATION',
        patientId: queueEntry.patientId,
        doctorId: queueEntry.doctorId,
        queueEntryId: queueEntry._id,
        items: [
          {
            description: `Consultation fee — Dr. ${doctor?.name || 'Doctor'}`,
            quantity: 1,
            rate: queueEntry.consultationFee,
            amount: queueEntry.consultationFee,
          },
        ],
        subtotal: queueEntry.consultationFee,
        discount: 0,
        total: queueEntry.consultationFee,
        balance: queueEntry.consultationFee,
        status: INVOICE_STATUSES.UNPAID,
        createdBy: actorId,
      });
      await writeAuditEntry({
        clinicId,
        actorId,
        action: 'invoice.create',
        resourceType: 'invoice',
        resourceId: invoice.id,
        ipAddress: requestContext?.ipAddress,
        userAgent: requestContext?.userAgent,
        metadata: { total: invoice.total, type: 'consultation' },
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      invoice = await Invoice.findOne({
        clinicId,
        queueEntryId: queueEntry._id,
        purpose: 'CONSULTATION',
      });
      if (!invoice) throw error;
    }
  }

  if (!queueEntry.consultationInvoiceId?.equals(invoice._id)) {
    await QueueEntry.updateOne(
      { _id: queueEntry._id, clinicId },
      { $set: { consultationInvoiceId: invoice._id } },
    );
    queueEntry.consultationInvoiceId = invoice._id;
  }
  if (invoice.status === INVOICE_STATUSES.PAID) {
    await releasePaidConsultationVisit(invoice, actorId);
    if (queueEntry.state === QUEUE_STATES.PAYMENT_PENDING) {
      queueEntry.state = QUEUE_STATES.WAITING;
    }
  }
  return invoice;
}

export async function releasePaidConsultationVisit(invoice, actorId) {
  if (invoice.purpose !== 'CONSULTATION' || invoice.balance !== 0 || !invoice.queueEntryId) {
    return;
  }
  const queueEntry = await QueueEntry.findOne({
    _id: invoice.queueEntryId,
    clinicId: invoice.clinicId,
    paymentRequired: true,
  });
  if (!queueEntry || queueEntry.state !== QUEUE_STATES.PAYMENT_PENDING) return;

  const now = new Date();
  queueEntry.state = QUEUE_STATES.WAITING;
  queueEntry.checkInAt = now;
  queueEntry.paymentClearedAt = now;
  queueEntry.transitions.push({
    from: QUEUE_STATES.PAYMENT_PENDING,
    to: QUEUE_STATES.WAITING,
    actorId,
    at: now,
  });
  try {
    await queueEntry.save();
  } catch (error) {
    if (error?.name !== 'VersionError') throw error;
    const current = await QueueEntry.findOne({ _id: queueEntry._id, clinicId: invoice.clinicId });
    if (current?.state !== QUEUE_STATES.WAITING) throw error;
    return;
  }
  await writeAuditEntry({
    clinicId: invoice.clinicId,
    actorId,
    action: 'queue.state_changed',
    resourceType: 'queue_entry',
    resourceId: queueEntry.id,
    metadata: {
      from: QUEUE_STATES.PAYMENT_PENDING,
      to: QUEUE_STATES.WAITING,
      reason: 'consultation_fee_paid',
    },
  });
}
