import { AppError } from '../common/app-error.js';
import { USER_STATUSES } from '@clinicos/contracts';
import { resolvePermissions } from '../modules/auth/auth.service.js';

function passwordChangeRequired(user) {
  return user?.status === USER_STATUSES.PASSWORD_RESET_REQUIRED;
}

function passwordChangeError() {
  return new AppError({
    code: 'PASSWORD_CHANGE_REQUIRED',
    message: 'Change your temporary password before using ClinicOS.',
    statusCode: 403,
  });
}

export function requirePasswordChangeComplete(req, _res, next) {
  if (passwordChangeRequired(req.user)) return next(passwordChangeError());
  next();
}

export function authorize(permission) {
  return (req, _res, next) => {
    if (passwordChangeRequired(req.user)) return next(passwordChangeError());
    if (!req.user || !resolvePermissions(req.user).includes(permission)) {
      return next(
        new AppError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action.',
          statusCode: 403,
        }),
      );
    }

    next();
  };
}

export function authorizeAny(permissions) {
  return (req, _res, next) => {
    if (passwordChangeRequired(req.user)) return next(passwordChangeError());
    const userPermissions = req.user ? resolvePermissions(req.user) : [];
    if (!permissions.some((permission) => userPermissions.includes(permission))) {
      return next(
        new AppError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action.',
          statusCode: 403,
        }),
      );
    }
    next();
  };
}
