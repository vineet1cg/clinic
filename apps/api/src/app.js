import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import pinoHttp from 'pino-http';
import { API_PREFIX } from '@clinicos/contracts';
import { AppError } from './common/app-error.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { isMongoReady } from './db/mongoose.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { rejectMongoOperators } from './middleware/sanitize.js';
import { requestId } from './middleware/request-id.js';
import { getRedisHealthClient } from './queues/redis.js';
import { apiRouter } from './routes/index.js';

const generalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(
      new AppError({
        statusCode: 429,
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please wait and try again.',
      }),
    ),
});

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      wrapSerializers: false,
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          path: req.url?.split('?')[0],
          remoteAddress: req.socket?.remoteAddress,
        }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
      genReqId: (req) => req.id,
      customProps: (req) => ({ actorId: req.user?.id }),
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-csrf-token"]',
        'res.headers["set-cookie"]',
      ],
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
    }),
  );
  app.use(generalLimiter);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());
  app.use(rejectMongoOperators);

  app.get('/health/live', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'clinicos-api' });
  });

  app.get('/health/ready', async (_req, res) => {
    const checks = { mongo: isMongoReady(), redis: false, openemr: !env.OPENEMR_ENABLED };

    try {
      checks.redis = (await getRedisHealthClient().ping()) === 'PONG';
    } catch {
      checks.redis = false;
    }

    if (env.OPENEMR_ENABLED) {
      try {
        const response = await fetch(new URL('/apis/default/fhir/metadata', env.OPENEMR_BASE_URL), {
          signal: AbortSignal.timeout(env.OPENEMR_TIMEOUT_MS),
        });
        checks.openemr = response.ok || response.status === 401;
      } catch {
        checks.openemr = false;
      }
    }

    const ready = Object.values(checks).every(Boolean);
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      ...(env.NODE_ENV === 'production' ? {} : { checks }),
    });
  });

  app.use(API_PREFIX, apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export function mongoConnectionState() {
  return mongoose.connection.readyState;
}
