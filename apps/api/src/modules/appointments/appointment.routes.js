import { Router } from 'express';
import {
  PERMISSIONS,
  appointmentCancelSchema,
  appointmentCreateSchema,
  appointmentListSchema,
} from '@clinicos/contracts';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { verifyCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import {
  cancelAppointment,
  checkInAppointment,
  createAppointment,
  listAppointments,
  listDoctors,
} from './appointment.controller.js';

export const appointmentRouter = Router();

appointmentRouter.use(authenticate);
appointmentRouter.get('/doctors', authorize(PERMISSIONS.APPOINTMENT_VIEW), listDoctors);
appointmentRouter.get(
  '/',
  authorize(PERMISSIONS.APPOINTMENT_VIEW),
  validate(appointmentListSchema, 'query'),
  listAppointments,
);
appointmentRouter.post(
  '/',
  authorize(PERMISSIONS.APPOINTMENT_CREATE),
  verifyCsrf,
  validate(appointmentCreateSchema),
  createAppointment,
);
appointmentRouter.post(
  '/:id/cancel',
  authorize(PERMISSIONS.APPOINTMENT_CANCEL),
  verifyCsrf,
  validate(appointmentCancelSchema),
  cancelAppointment,
);
appointmentRouter.post(
  '/:id/check-in',
  authorize(PERMISSIONS.QUEUE_MANAGE),
  authorize(PERMISSIONS.BILLING_VIEW),
  verifyCsrf,
  checkInAppointment,
);
