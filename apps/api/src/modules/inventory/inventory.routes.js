import { Router } from 'express';
import {
  PERMISSIONS,
  inventoryItemCreateSchema,
  inventoryTransactionSchema,
} from '@clinicos/contracts';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { verifyCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import {
  createInventoryItem,
  listInventory,
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
inventoryRouter.post(
  '/:id/transactions',
  authorize(PERMISSIONS.INVENTORY_ADJUST),
  verifyCsrf,
  validate(inventoryTransactionSchema),
  recordInventoryTransaction,
);
