import { NOTIFICATION_JOB_TYPES } from '@clinicos/contracts';
import { config } from '../config.js';

const supportedJobs = new Set(Object.values(NOTIFICATION_JOB_TYPES));

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

  return {
    delivered: false,
    provider: 'development-log',
    acceptedAt: new Date().toISOString(),
    jobId: String(job.id),
  };
}
