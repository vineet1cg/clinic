import jwt from 'jsonwebtoken';
import { USER_STATUSES } from '@clinicos/contracts';
import { AppError } from '../common/app-error.js';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';

export async function authenticate(req, _res, next) {
  const bearerToken = req.get('authorization')?.startsWith('Bearer ')
    ? req.get('authorization').slice(7)
    : null;
  const token = req.cookies[env.COOKIE_NAME] || bearerToken;

  if (!token) {
    return next(
      new AppError({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Please sign in to continue.',
        statusCode: 401,
      }),
    );
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'clinicos-api',
      audience: 'clinicos-web',
    });
    const user = await User.findById(payload.sub).select('+sessionVersion');

    if (
      !user ||
      !user.clinicId ||
      payload.sessionVersion !== user.sessionVersion ||
      (user.status !== USER_STATUSES.ACTIVE &&
        user.status !== USER_STATUSES.PASSWORD_RESET_REQUIRED)
    ) {
      throw new Error('Session user is unavailable');
    }

    req.user = user;
    req.auth = { csrfToken: payload.csrfToken, sessionVersion: payload.sessionVersion };
    next();
  } catch {
    next(
      new AppError({
        code: 'INVALID_SESSION',
        message: 'Your session has expired. Please sign in again.',
        statusCode: 401,
      }),
    );
  }
}
