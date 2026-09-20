import { Router } from 'express';
import {
  PERMISSIONS,
  queueListSchema,
  queueTransitionSchema,
  walkInCreateSchema,
} from '@clinicos/contracts';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { verifyCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import {
  createWalkIn,
  getQueueEntry,
  listQueue,
  publicQueueDisplay,
  recoverConsultationInvoice,
  transitionQueueEntry,
} from './queue.controller.js';

export const queueRouter = Router();

queueRouter.get('/display/:doctorId', publicQueueDisplay);
queueRouter.use(authenticate);
queueRouter.get(
  '/today',
  authorize(PERMISSIONS.QUEUE_VIEW),
  validate(queueListSchema, 'query'),
  listQueue,
);
queueRouter.post(
  '/',
  authorize(PERMISSIONS.QUEUE_MANAGE),
  authorize(PERMISSIONS.BILLING_VIEW),
  verifyCsrf,
  validate(walkInCreateSchema),
  createWalkIn,
);
queueRouter.get('/:id', authorize(PERMISSIONS.QUEUE_VIEW), getQueueEntry);
queueRouter.post(
  '/:id/consultation-invoice',
  authorize(PERMISSIONS.QUEUE_MANAGE),
  authorize(PERMISSIONS.BILLING_VIEW),
  verifyCsrf,
  recoverConsultationInvoice,
);
queueRouter.patch(
  '/:id/state',
  authorize(PERMISSIONS.QUEUE_MANAGE),
  verifyCsrf,
  validate(queueTransitionSchema),
  transitionQueueEntry,
);
