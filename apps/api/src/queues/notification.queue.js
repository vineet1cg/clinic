import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@clinicos/contracts';
import { createRedisConnection } from './redis.js';

const connection = createRedisConnection({ forWorker: true });

export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATIONS, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
    removeOnFail: { age: 7 * 24 * 60 * 60, count: 5000 },
  },
});

export async function closeQueues() {
  await notificationQueue.close();
  await connection.quit();
}
