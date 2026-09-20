import { Router } from 'express';
import { PERMISSIONS, reportQuerySchema } from '@clinicos/contracts';
import { authenticate } from '../../middleware/authenticate.js';
import { authorizeAny, requirePasswordChangeComplete } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { getDashboardSummary, getReportSummary } from './report.controller.js';

export const reportRouter = Router();

reportRouter.use(authenticate);
reportRouter.get('/dashboard', requirePasswordChangeComplete, getDashboardSummary);
reportRouter.get(
  '/summary',
  authorizeAny([PERMISSIONS.REPORT_OPERATIONAL, PERMISSIONS.REPORT_FINANCIAL]),
  validate(reportQuerySchema, 'query'),
  getReportSummary,
);
