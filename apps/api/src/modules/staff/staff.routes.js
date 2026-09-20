import { Router } from 'express';
import {
  PERMISSIONS,
  staffCreateSchema,
  staffListSchema,
  staffUpdateSchema,
} from '@clinicos/contracts';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { verifyCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { createStaff, listRoles, listStaff, updateStaff } from './staff.controller.js';

export const staffRouter = Router();

staffRouter.use(authenticate);
staffRouter.get(
  '/',
  authorize(PERMISSIONS.STAFF_VIEW),
  validate(staffListSchema, 'query'),
  listStaff,
);
staffRouter.get('/roles', authorize(PERMISSIONS.STAFF_VIEW), listRoles);
staffRouter.post(
  '/',
  authorize(PERMISSIONS.STAFF_CREATE),
  verifyCsrf,
  validate(staffCreateSchema),
  createStaff,
);
staffRouter.patch(
  '/:id',
  authorize(PERMISSIONS.STAFF_UPDATE),
  verifyCsrf,
  validate(staffUpdateSchema),
  updateStaff,
);
