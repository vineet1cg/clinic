import { Router } from 'express';
import {
  PERMISSIONS,
  invoiceCreateSchema,
  invoiceListSchema,
  paymentCreateSchema,
} from '@clinicos/contracts';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { verifyCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { collectPayment, createInvoice, getInvoice, listInvoices } from './billing.controller.js';

export const billingRouter = Router();

billingRouter.use(authenticate);
billingRouter.get(
  '/invoices',
  authorize(PERMISSIONS.BILLING_VIEW),
  validate(invoiceListSchema, 'query'),
  listInvoices,
);
billingRouter.post(
  '/invoices',
  authorize(PERMISSIONS.BILLING_CREATE),
  verifyCsrf,
  validate(invoiceCreateSchema),
  createInvoice,
);
billingRouter.get('/invoices/:id', authorize(PERMISSIONS.BILLING_VIEW), getInvoice);
billingRouter.post(
  '/invoices/:id/payments',
  authorize(PERMISSIONS.PAYMENT_COLLECT),
  verifyCsrf,
  validate(paymentCreateSchema),
  collectPayment,
);
