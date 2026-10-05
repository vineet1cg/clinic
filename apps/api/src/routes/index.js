import { Router } from 'express';
import { appointmentRouter } from '../modules/appointments/appointment.routes.js';
import { auditRouter } from '../modules/audit/audit.routes.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { billingRouter } from '../modules/billing/billing.routes.js';
import { encounterRouter } from '../modules/encounters/encounter.routes.js';
import { inventoryRouter } from '../modules/inventory/inventory.routes.js';
import { labRouter } from '../modules/lab/lab.routes.js';
import { patientRouter } from '../modules/patients/patient.routes.js';
import { queueRouter } from '../modules/queue/queue.routes.js';
import { reportRouter } from '../modules/reports/report.routes.js';
import { settingsRouter } from '../modules/settings/settings.routes.js';
import { staffRouter } from '../modules/staff/staff.routes.js';

export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.json({
    name: 'ClinicOS API',
    version: 'v1',
    status: 'ready',
    resources: [
      'auth',
      'staff',
      'patients',
      'appointments',
      'queue',
      'encounters',
      'billing',
      'reports',
      'audit',
      'settings',
      'inventory',
      'lab',
    ],
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/audit', auditRouter);
apiRouter.use('/patients', patientRouter);
apiRouter.use('/appointments', appointmentRouter);
apiRouter.use('/queue', queueRouter);
apiRouter.use('/encounters', encounterRouter);
apiRouter.use('/billing', billingRouter);
apiRouter.use('/reports', reportRouter);
apiRouter.use('/staff', staffRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/lab', labRouter);
