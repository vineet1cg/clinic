import { NOTIFICATION_JOB_TYPES } from '@clinicos/contracts';
import { logger } from '../config/logger.js';
import { notificationQueue } from './notification.queue.js';

export async function enqueueNotification(jobName, data, options = {}) {
  try {
    const job = await notificationQueue.add(jobName, data, options);
    logger.info(
      { jobId: job.id, jobName, recipient: data.recipient ? 'REDACTED' : undefined },
      'Notification enqueued',
    );
    return job;
  } catch (error) {
    logger.warn(
      { error, jobName },
      'Failed to enqueue notification job; continuing without failing request',
    );
    return null;
  }
}

export async function enqueuePaymentReceiptNotification({ clinicId, invoice, patient, payment }) {
  const recipient = patient?.mobile || patient?.email;
  if (!recipient) return null;

  return enqueueNotification(
    NOTIFICATION_JOB_TYPES.PAYMENT_RECEIPT,
    {
      clinicId: String(clinicId),
      recipient,
      templateCode: 'payment_receipt',
      channel: patient?.email && recipient.includes('@') ? 'email' : 'sms',
      payload: {
        invoiceNumber: invoice.invoiceNumber,
        amount: payment?.amount ?? invoice.paidAmount,
        method: payment?.method ?? 'CASH',
        patientName: patient.fullName,
        balance: invoice.balance,
      },
    },
    { jobId: `receipt:${invoice._id}:${payment?.idempotencyKey || Date.now()}` },
  );
}

export async function enqueueAppointmentConfirmationNotification({
  clinicId,
  appointment,
  patient,
  doctor,
}) {
  const recipient = patient?.mobile || patient?.email;
  if (!recipient) return null;

  return enqueueNotification(
    NOTIFICATION_JOB_TYPES.APPOINTMENT_CONFIRMATION,
    {
      clinicId: String(clinicId),
      recipient,
      templateCode: 'appointment_confirmation',
      channel: patient?.email && recipient.includes('@') ? 'email' : 'sms',
      payload: {
        appointmentId: String(appointment._id),
        patientName: patient.fullName,
        doctorName: doctor?.name || 'Doctor',
        date: appointment.date,
        time: appointment.time,
      },
    },
    { jobId: `appointment-confirm:${appointment._id}` },
  );
}

export async function enqueueLabResultReadyNotification({ clinicId, labOrder, patient }) {
  const recipient = patient?.mobile || patient?.email;
  if (!recipient) return null;

  return enqueueNotification(
    NOTIFICATION_JOB_TYPES.LAB_RESULT_READY,
    {
      clinicId: String(clinicId),
      recipient,
      templateCode: 'lab_result_ready',
      channel: patient?.email && recipient.includes('@') ? 'email' : 'sms',
      payload: {
        labOrderId: String(labOrder._id),
        testName: labOrder.testName,
        patientName: patient.fullName,
      },
    },
    { jobId: `lab-ready:${labOrder._id}` },
  );
}

export async function enqueueQueueTokenCalledNotification({
  clinicId,
  queueEntry,
  patient,
  doctor,
}) {
  const recipient = patient?.mobile || patient?.email;
  if (!recipient) return null;

  return enqueueNotification(
    NOTIFICATION_JOB_TYPES.QUEUE_TOKEN_CALLED,
    {
      clinicId: String(clinicId),
      recipient,
      templateCode: 'queue_token_called',
      channel: patient?.email && recipient.includes('@') ? 'email' : 'sms',
      payload: {
        queueEntryId: String(queueEntry._id),
        tokenNumber: queueEntry.tokenDisplay || queueEntry.tokenNumber,
        doctorName: doctor?.name || 'Doctor',
        patientName: patient.fullName,
      },
    },
    { jobId: `queue-called:${queueEntry._id}:${Date.now()}` },
  );
}
