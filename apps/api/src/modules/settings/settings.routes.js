import { Router } from 'express';
import { PERMISSIONS, clinicSettingsSchema } from '@clinicos/contracts';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { verifyCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { getSettings, updateSettings } from './settings.controller.js';

export const settingsRouter = Router();

settingsRouter.use(authenticate);
settingsRouter.get('/', authorize(PERMISSIONS.SETTINGS_VIEW), getSettings);
settingsRouter.put(
  '/',
  authorize(PERMISSIONS.SETTINGS_UPDATE),
  verifyCsrf,
  validate(clinicSettingsSchema),
  updateSettings,
);
