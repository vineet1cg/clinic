import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().max(50).default(5),
  NOTIFICATION_PROVIDER: z.enum(['development-log', 'disabled']).default('development-log'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(
    `Invalid worker environment: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
  );
}

if (
  parsed.data.NODE_ENV === 'production' &&
  parsed.data.NOTIFICATION_PROVIDER === 'development-log'
) {
  throw new Error('NOTIFICATION_PROVIDER must not use development-log in production');
}

export const config = Object.freeze(parsed.data);
