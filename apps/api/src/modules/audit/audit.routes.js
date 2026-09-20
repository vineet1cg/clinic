import { Router } from 'express';
import { PERMISSIONS, auditLogQuerySchema } from '@clinicos/contracts';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { listAuditLogs } from './audit.controller.js';

export const auditRouter = Router();

auditRouter.use(authenticate);
auditRouter.get(
  '/',
  authorize(PERMISSIONS.AUDIT_VIEW),
  validate(auditLogQuerySchema, 'query'),
  listAuditLogs,
);
