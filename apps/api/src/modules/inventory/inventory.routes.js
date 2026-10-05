import { Router } from 'express';
import {
  PERMISSIONS,
  inventoryItemCreateSchema,
  inventoryTransactionSchema,
  prescriptionDispenseSchema,
} from '@clinicos/contracts';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { verifyCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import {
  createInventoryItem,
  dispensePrescription,
  listInventory,
  listPendingPrescriptions,
  recordInventoryTransaction,
} from './inventory.controller.js';

export const inventoryRouter = Router();

inventoryRouter.use(authenticate);
inventoryRouter.get('/', authorize(PERMISSIONS.INVENTORY_VIEW), listInventory);
inventoryRouter.post(
  '/',
  authorize(PERMISSIONS.INVENTORY_UPDATE),
  verifyCsrf,
  validate(inventoryItemCreateSchema),
  createInventoryItem,
);
inventoryRouter.get(
  '/prescriptions/pending',
  authorize(PERMISSIONS.INVENTORY_VIEW),
  listPendingPrescriptions,
);
inventoryRouter.post(
  '/prescriptions/:encounterId/:prescriptionId/dispense',
  authorize(PERMISSIONS.INVENTORY_ADJUST),
  verifyCsrf,
  validate(prescriptionDispenseSchema),
  dispensePrescription,
);
inventoryRouter.post(
  '/:id/transactions',
  authorize(PERMISSIONS.INVENTORY_ADJUST),
  verifyCsrf,
  validate(inventoryTransactionSchema),
  recordInventoryTransaction,
);
