import { AppError } from '../common/app-error.js';

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req[source]);

    if (!parsed.success) {
      return next(
        new AppError({
          code: 'VALIDATION_ERROR',
          message: 'Some submitted fields need attention.',
          statusCode: 422,
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        }),
      );
    }

    if (source === 'body') {
      req.body = parsed.data;
    } else {
      req.validated = { ...(req.validated || {}), [source]: parsed.data };
    }
    next();
  };
}
