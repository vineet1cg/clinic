import { NOTIFICATION_JOB_TYPES } from '@clinicos/contracts';
import { config } from '../config.js';

const supportedJobs = new Set(Object.values(NOTIFICATION_JOB_TYPES));

export function formatNotificationMessage(jobName, payload = {}) {
  switch (jobName) {
    case NOTIFICATION_JOB_TYPES.PAYMENT_RECEIPT:
      return `Dear ${payload.patientName || 'Patient'}, payment of ₹${payload.amount || 0} for invoice ${payload.invoiceNumber || ''} has been received. Thank you for visiting ClinicOS.`;

    case NOTIFICATION_JOB_TYPES.APPOINTMENT_CONFIRMATION:
      return `Dear ${payload.patientName || 'Patient'}, your appointment with Dr. ${payload.doctorName || 'Doctor'} is confirmed for ${payload.date || ''} at ${payload.time || ''}.`;

    case NOTIFICATION_JOB_TYPES.LAB_RESULT_READY:
      return `Dear ${payload.patientName || 'Patient'}, your laboratory test results for "${payload.testName || 'Investigation'}" are ready.`;

    case NOTIFICATION_JOB_TYPES.QUEUE_TOKEN_CALLED:
      return `Token ${payload.tokenNumber || ''}: Dr. ${payload.doctorName || 'Doctor'} is ready to see you now.`;

    case NOTIFICATION_JOB_TYPES.APPOINTMENT_REMINDER:
      return `Reminder: Your appointment with Dr. ${payload.doctorName || 'Doctor'} is scheduled for ${payload.date || ''} at ${payload.time || ''}.`;

    case NOTIFICATION_JOB_TYPES.FOLLOW_UP_REMINDER:
      return `Follow-up reminder: Please schedule your follow-up visit with Dr. ${payload.doctorName || 'Doctor'}.`;

    default:
      return `Notification from ClinicOS for ${payload.patientName || 'Patient'}.`;
  }
}

export async function processNotificationJob(job) {
  if (!supportedJobs.has(job.name)) {
    throw new Error(`Unsupported notification job: ${job.name}`);
  }

  if (!job.data?.recipient || !job.data?.templateCode) {
    throw new Error('Notification jobs require recipient and templateCode');
  }

  if (config.NOTIFICATION_PROVIDER === 'disabled') {
    throw new Error('Notification provider is disabled');
  }

  const messageText = formatNotificationMessage(job.name, job.data.payload || {});
  const channel = job.data.channel || (String(job.data.recipient).includes('@') ? 'email' : 'sms');
  const now = new Date().toISOString();

  if (config.NOTIFICATION_PROVIDER === 'webhook' && config.NOTIFICATION_WEBHOOK_URL) {
    try {
      const response = await fetch(config.NOTIFICATION_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: String(job.id),
          jobName: job.name,
          recipient: job.data.recipient,
          channel,
          message: messageText,
          payload: job.data.payload,
          timestamp: now,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        throw new Error(`Webhook responded with status ${response.status}`);
      }

      return {
        delivered: true,
        provider: 'webhook',
        channel,
        acceptedAt: now,
        jobId: String(job.id),
        messageSummary: messageText.slice(0, 80),
      };
    } catch (error) {
      throw new Error(`Failed to deliver notification via webhook: ${error.message}`, {
        cause: error,
      });
    }
  }

  if (config.NOTIFICATION_PROVIDER === 'development-log') {
    return {
      delivered: false,
      provider: 'development-log',
      channel,
      acceptedAt: now,
      jobId: String(job.id),
      messageSummary: messageText.slice(0, 80),
    };
  }

  // Default: console / direct notification logging
  return {
    delivered: true,
    provider: config.NOTIFICATION_PROVIDER || 'console',
    channel,
    acceptedAt: now,
    jobId: String(job.id),
    messageSummary: messageText.slice(0, 80),
  };
}
