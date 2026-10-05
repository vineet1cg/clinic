import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().max(50).default(5),
  NOTIFICATION_PROVIDER: z
    .enum(['webhook', 'smtp', 'console', 'development-log', 'disabled'])
    .default('console'),
  NOTIFICATION_WEBHOOK_URL: z.string().url().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  NOTIFICATION_FROM_EMAIL: z.string().default('notifications@clinic.local'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(
    `Invalid worker environment: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
  );
}

export const config = Object.freeze(parsed.data);
