import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: process.env.VITEST ? 'silent' : env.LOG_LEVEL,
  base: { service: 'clinicos-api', environment: env.NODE_ENV },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-csrf-token"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.accessToken',
      '*.clientSecret',
    ],
    censor: '[REDACTED]',
  },
});
