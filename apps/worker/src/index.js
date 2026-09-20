import { Worker } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';
import { QUEUE_NAMES } from '@clinicos/contracts';
import { config } from './config.js';
import { processNotificationJob } from './handlers/notification.handler.js';

const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: 'clinicos-worker', environment: config.NODE_ENV },
  redact: ['*.recipient', '*.payload', '*.medicalData'],
});

const connection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  connectTimeout: 5000,
  retryStrategy: (attempt) => Math.min(attempt * 250, 2000),
});

const worker = new Worker(QUEUE_NAMES.NOTIFICATIONS, processNotificationJob, {
  connection,
  concurrency: config.WORKER_CONCURRENCY,
});

worker.on('ready', () => logger.info('Notification worker is ready'));
worker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, jobName: job.name, delivered: result.delivered }, 'Job completed');
});
worker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, jobName: job?.name, error }, 'Job failed');
});
worker.on('error', (error) => logger.error({ error }, 'Worker connection error'));

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down notification worker');
  await worker.close();
  await connection.quit();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    shutdown(signal)
      .then(() => process.exit(0))
      .catch((error) => {
        logger.fatal({ error }, 'Worker shutdown failed');
        process.exit(1);
      });
  });
}
