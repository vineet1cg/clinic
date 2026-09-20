import { Router } from 'express';
import {
  PERMISSIONS,
  encounterCreateSchema,
  encounterUpdateSchema,
  vitalsSchema,
} from '@clinicos/contracts';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { verifyCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import {
  completeEncounter,
  createEncounter,
  getEncounterByQueue,
  recordVitals,
  updateEncounter,
} from './encounter.controller.js';

export const encounterRouter = Router();

encounterRouter.use(authenticate);
encounterRouter.get('/queue/:queueId', authorize(PERMISSIONS.ENCOUNTER_VIEW), getEncounterByQueue);
encounterRouter.post(
  '/',
  authorize(PERMISSIONS.ENCOUNTER_CREATE),
  verifyCsrf,
  validate(encounterCreateSchema),
  createEncounter,
);
encounterRouter.patch(
  '/:id',
  authorize(PERMISSIONS.ENCOUNTER_UPDATE),
  verifyCsrf,
  validate(encounterUpdateSchema),
  updateEncounter,
);
encounterRouter.post(
  '/:id/vitals',
  authorize(PERMISSIONS.VITALS_CREATE),
  verifyCsrf,
  validate(vitalsSchema),
  recordVitals,
);
encounterRouter.post(
  '/:id/complete',
  authorize(PERMISSIONS.ENCOUNTER_COMPLETE),
  verifyCsrf,
  completeEncounter,
);
