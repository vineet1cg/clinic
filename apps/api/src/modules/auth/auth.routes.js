import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { changePasswordSchema, loginSchema } from '@clinicos/contracts';
import { AppError } from '../../common/app-error.js';
import { authenticate } from '../../middleware/authenticate.js';
import { verifyCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { changePassword, login, logout, me } from './auth.controller.js';

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(
      new AppError({
        statusCode: 429,
        code: 'AUTH_RATE_LIMITED',
        message: 'Too many sign-in attempts from this network address. Please wait and try again.',
      }),
    ),
});

export const authRouter = Router();

authRouter.post('/login', authLimiter, validate(loginSchema), login);
authRouter.post('/logout', authenticate, verifyCsrf, logout);
authRouter.post(
  '/change-password',
  authenticate,
  verifyCsrf,
  validate(changePasswordSchema),
  changePassword,
);
authRouter.get('/me', authenticate, me);
