import { Router } from 'express';
import {
  PERMISSIONS,
  labOrderCreateSchema,
  labOrderListSchema,
  labOrderUpdateSchema,
} from '@clinicos/contracts';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize, authorizeAny } from '../../middleware/authorize.js';
import { verifyCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { createLabOrder, listLabOrders, updateLabOrder } from './lab.controller.js';

export const labRouter = Router();

labRouter.use(authenticate);
labRouter.get(
  '/',
  authorize(PERMISSIONS.LAB_VIEW),
  validate(labOrderListSchema, 'query'),
  listLabOrders,
);
labRouter.post(
  '/',
  authorize(PERMISSIONS.LAB_ORDER),
  verifyCsrf,
  validate(labOrderCreateSchema),
  createLabOrder,
);
labRouter.patch(
  '/:id',
  authorizeAny([PERMISSIONS.LAB_RESULT_CREATE, PERMISSIONS.LAB_RESULT_VERIFY]),
  verifyCsrf,
  validate(labOrderUpdateSchema),
  updateLabOrder,
);
