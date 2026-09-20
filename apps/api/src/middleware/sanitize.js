import { AppError } from '../common/app-error.js';

const prototypeKeys = new Set(['__proto__', 'constructor', 'prototype']);

function containsUnsafeKey(value) {
  if (!value || typeof value !== 'object') return false;

  return Object.entries(value).some(
    ([key, child]) =>
      key.startsWith('$') ||
      key.includes('.') ||
      prototypeKeys.has(key) ||
      containsUnsafeKey(child),
  );
}

export function rejectMongoOperators(req, _res, next) {
  if (
    containsUnsafeKey(req.body) ||
    containsUnsafeKey(req.query) ||
    containsUnsafeKey(req.params)
  ) {
    return next(
      new AppError({
        code: 'UNSAFE_INPUT',
        message: 'Request contains unsupported field names.',
        statusCode: 400,
      }),
    );
  }

  next();
}
