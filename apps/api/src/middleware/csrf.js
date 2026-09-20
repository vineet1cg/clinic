import { timingSafeEqual } from 'node:crypto';
import { AppError } from '../common/app-error.js';

function equalTokens(left, right) {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyCsrf(req, _res, next) {
  const headerToken = req.get('x-csrf-token');
  const cookieToken = req.cookies.clinicos_csrf;
  const sessionToken = req.auth?.csrfToken;

  if (!equalTokens(headerToken, cookieToken) || !equalTokens(headerToken, sessionToken)) {
    return next(
      new AppError({
        code: 'CSRF_VALIDATION_FAILED',
        message: 'The request security token is missing or expired. Refresh and try again.',
        statusCode: 403,
      }),
    );
  }

  next();
}
