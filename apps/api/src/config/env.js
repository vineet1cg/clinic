import 'dotenv/config';
import { z } from 'zod';

const booleanFromEnv = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

function usesHttps(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isTimeZone(value) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/clinicos'),
    DEFAULT_CLINIC_ID: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .default('000000000000000000000001'),
    CLINIC_TIMEZONE: z
      .string()
      .refine(isTimeZone, 'Enter a valid IANA timezone')
      .default('Asia/Kolkata'),
    REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
    APP_BASE_URL: z.url().default('http://localhost:5173'),
    CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost'),
    JWT_SECRET: z.string().min(32).default('development-secret-change-before-prod'),
    JWT_EXPIRES_IN: z.string().default('8h'),
    SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(480),
    COOKIE_NAME: z.string().default('clinicos_session'),
    COOKIE_SECURE: booleanFromEnv,
    LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
    LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production') {
      if (
        value.JWT_SECRET.length < 64 ||
        /(change|replace|development|local|example)/i.test(value.JWT_SECRET)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['JWT_SECRET'],
          message:
            'JWT_SECRET must be a non-example secret of at least 64 characters in production',
        });
      }
      if (!value.COOKIE_SECURE) {
        context.addIssue({
          code: 'custom',
          path: ['COOKIE_SECURE'],
          message: 'COOKIE_SECURE must be true in production',
        });
      }
      if (!usesHttps(value.APP_BASE_URL)) {
        context.addIssue({
          code: 'custom',
          path: ['APP_BASE_URL'],
          message: 'APP_BASE_URL must use HTTPS in production',
        });
      }
      const insecureCorsOrigin = value.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
        .find((origin) => !usesHttps(origin));
      if (insecureCorsOrigin) {
        context.addIssue({
          code: 'custom',
          path: ['CORS_ORIGINS'],
          message: 'Every CORS origin must use HTTPS in production',
        });
      }
    }
  });

export function parseApiEnv(input) {
  const parsed = envSchema.safeParse(input);

  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid API environment: ${messages}`);
  }

  return Object.freeze({
    ...parsed.data,
    CORS_ORIGINS: parsed.data.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  });
}

export const env = parseApiEnv(process.env);
