import Redis from 'ioredis';
import { env } from '../config/env.js';

let healthClient;

export function createRedisConnection({ forWorker = false } = {}) {
  return new Redis(env.REDIS_URL, {
    lazyConnect: true,
    enableReadyCheck: true,
    connectTimeout: 5000,
    maxRetriesPerRequest: forWorker ? null : 1,
    retryStrategy: (attempt) => Math.min(attempt * 250, 2000),
  });
}

export function getRedisHealthClient() {
  if (!healthClient) healthClient = createRedisConnection();
  return healthClient;
}

export async function closeRedisHealthClient() {
  if (healthClient) {
    await healthClient.quit();
    healthClient = undefined;
  }
}
