import { AppError } from '../common/app-error.js';
import { logger } from '../config/logger.js';

export function errorHandler(error, req, res, _next) {
  const duplicateKey = error?.code === 11000;
  const invalidIdentifier = error?.name === 'CastError';
  const validationFailure = error?.name === 'ValidationError';
  const versionConflict = error?.name === 'VersionError';
  const malformedJson = error instanceof SyntaxError && error?.status === 400 && 'body' in error;
  const payloadTooLarge = error?.type === 'entity.too.large';
  const openEmrFailure = error?.name === 'OpenEmrError';
  const knownError = error instanceof AppError;
  const statusCode = knownError
    ? error.statusCode
    : duplicateKey
      ? 409
      : versionConflict
        ? 409
        : malformedJson
          ? 400
          : payloadTooLarge
            ? 413
            : openEmrFailure
              ? 502
              : invalidIdentifier || validationFailure
                ? 422
                : 500;
  const code = knownError
    ? error.code
    : duplicateKey
      ? 'DUPLICATE_RECORD'
      : versionConflict
        ? 'RECORD_CHANGED'
        : malformedJson
          ? 'INVALID_JSON'
          : payloadTooLarge
            ? 'PAYLOAD_TOO_LARGE'
            : openEmrFailure
              ? 'OPENEMR_UNAVAILABLE'
              : invalidIdentifier
                ? 'INVALID_IDENTIFIER'
                : validationFailure
                  ? 'DATABASE_VALIDATION_ERROR'
                  : 'INTERNAL_SERVER_ERROR';
  const message = knownError
    ? error.message
    : duplicateKey
      ? 'A record with these details already exists.'
      : versionConflict
        ? 'This record changed while you were editing it. Refresh and try again.'
        : malformedJson
          ? 'The request body contains invalid JSON.'
          : payloadTooLarge
            ? 'The request body is too large.'
            : openEmrFailure
              ? 'OpenEMR is temporarily unavailable. Try again shortly.'
              : invalidIdentifier
                ? 'The supplied record identifier is invalid.'
                : validationFailure
                  ? 'The record could not be saved because some fields are invalid.'
                  : 'An unexpected error occurred.';

  const logContext = {
    requestId: req.id,
    code,
    statusCode,
    route: req.originalUrl?.split('?')[0],
    method: req.method,
  };

  if (statusCode >= 500) {
    logger.error({ ...logContext, error }, 'Request failed');
  } else {
    logger.warn(logContext, 'Request rejected');
  }

  const payload = {
    error: {
      code,
      message,
      requestId: req.id,
      ...(knownError && error.details ? { details: error.details } : {}),
    },
  };

  res.status(statusCode).json(payload);
}
