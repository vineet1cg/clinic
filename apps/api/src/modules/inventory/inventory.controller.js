import { AppError } from '../../common/app-error.js';
import { getClinicId } from '../../common/clinic-context.js';
import { InventoryItem } from '../../models/inventory-item.model.js';
import { writeAuditEntry } from '../audit/audit.service.js';

export async function listInventory(req, res) {
  const inventory = await InventoryItem.find({ clinicId: getClinicId(req.user) }).sort({
    name: 1,
    expiryDate: 1,
  });
  res.json({ inventory });
}

export async function createInventoryItem(req, res) {
  const clinicId = getClinicId(req.user);
  const exists = await InventoryItem.exists({ clinicId, sku: req.body.sku });
  if (exists)
    throw new AppError({
      code: 'INVENTORY_SKU_EXISTS',
      message: 'An inventory item already uses this SKU.',
      statusCode: 409,
    });
  const item = await InventoryItem.create({ ...req.body, clinicId, createdBy: req.user._id });
  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'inventory.item_create',
    resourceType: 'inventory_item',
    resourceId: item.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.status(201).json({ item });
}

export async function recordInventoryTransaction(req, res) {
  const clinicId = getClinicId(req.user);
  const item = await InventoryItem.findOne({ _id: req.params.id, clinicId });
  if (!item)
    throw new AppError({
      code: 'INVENTORY_ITEM_NOT_FOUND',
      message: 'Inventory item was not found.',
      statusCode: 404,
    });
  const decreases = ['DISPENSE', 'ADJUSTMENT_OUT'].includes(req.body.type);
  const delta = decreases ? -req.body.quantity : req.body.quantity;
  if (item.quantityOnHand + delta < 0) {
    throw new AppError({
      code: 'INSUFFICIENT_STOCK',
      message: 'This transaction would make stock negative.',
      statusCode: 409,
    });
  }
  item.quantityOnHand += delta;
  item.transactions.push({ ...req.body, delta, actorId: req.user._id, at: new Date() });
  await item.save();
  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'inventory.transaction',
    resourceType: 'inventory_item',
    resourceId: item.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { type: req.body.type, quantity: req.body.quantity },
  });
  res.json({ item });
}
