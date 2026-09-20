import { QUEUE_TRANSITIONS } from '@clinicos/contracts';
import { AppError } from '../../common/app-error.js';

export function assertQueueTransition(from, to) {
  const allowed = QUEUE_TRANSITIONS[from];

  if (!allowed || !allowed.includes(to)) {
    throw new AppError({
      code: 'INVALID_QUEUE_TRANSITION',
      message: `Queue cannot transition from ${from} to ${to}.`,
      statusCode: 409,
      details: { from, to, allowed: allowed || [] },
    });
  }

  return true;
}
