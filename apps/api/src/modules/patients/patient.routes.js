import { Router } from 'express';
import {
  PERMISSIONS,
  patientCreateSchema,
  patientSearchSchema,
  patientUpdateSchema,
} from '@clinicos/contracts';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { verifyCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { createPatient, getPatient, searchPatients, updatePatient } from './patient.controller.js';

export const patientRouter = Router();

patientRouter.use(authenticate);
patientRouter.get(
  '/search',
  authorize(PERMISSIONS.PATIENT_VIEW),
  validate(patientSearchSchema, 'query'),
  searchPatients,
);
patientRouter.post(
  '/',
  authorize(PERMISSIONS.PATIENT_CREATE),
  verifyCsrf,
  validate(patientCreateSchema),
  createPatient,
);
patientRouter.get('/:id', authorize(PERMISSIONS.PATIENT_VIEW), getPatient);
patientRouter.patch(
  '/:id',
  authorize(PERMISSIONS.PATIENT_UPDATE),
  verifyCsrf,
  validate(patientUpdateSchema),
  updatePatient,
);
