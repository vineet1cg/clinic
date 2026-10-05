import { QUEUE_STATES } from '@clinicos/contracts';
import { AppError } from '../../common/app-error.js';
import { getClinicId } from '../../common/clinic-context.js';
import { runInTransaction } from '../../db/transaction.js';
import { Encounter } from '../../models/encounter.model.js';
import { InventoryItem } from '../../models/inventory-item.model.js';
import { QueueEntry } from '../../models/queue-entry.model.js';
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

export async function listPendingPrescriptions(req, res) {
  const clinicId = getClinicId(req.user);
  const encounters = await Encounter.find({
    clinicId,
    status: 'COMPLETED',
    'prescriptions.0': { $exists: true },
    'prescriptions.dispensed': { $ne: true },
  })
    .populate('patientId', 'patientNumber fullName mobile dateOfBirth age gender')
    .populate('doctorId', 'name')
    .sort({ completedAt: -1 })
    .limit(100);

  const pending = [];
  for (const enc of encounters) {
    const pendingItems = enc.prescriptions.filter((p) => !p.dispensed);
    if (pendingItems.length > 0) {
      pending.push({
        encounterId: enc.id,
        patient: enc.patientId,
        doctor: enc.doctorId,
        queueEntryId: enc.queueEntryId,
        completedAt: enc.completedAt,
        prescriptions: pendingItems.map((p) => ({
          id: p.id,
          medicine: p.medicine,
          dose: p.dose,
          frequency: p.frequency,
          duration: p.duration,
          instructions: p.instructions,
          quantity: p.quantity || 1,
        })),
      });
    }
  }

  res.json({ pending });
}

export async function dispensePrescription(req, res) {
  const clinicId = getClinicId(req.user);
  const { encounterId, prescriptionId } = req.params;
  const { inventoryItemId, quantity, reason } = req.body;

  const encounter = await Encounter.findOne({ _id: encounterId, clinicId });
  if (!encounter) {
    throw new AppError({
      code: 'ENCOUNTER_NOT_FOUND',
      message: 'Consultation encounter was not found.',
      statusCode: 404,
    });
  }

  const prescription = encounter.prescriptions.id(prescriptionId);
  if (!prescription) {
    throw new AppError({
      code: 'PRESCRIPTION_NOT_FOUND',
      message: 'Prescription item was not found on this encounter.',
      statusCode: 404,
    });
  }

  if (prescription.dispensed) {
    throw new AppError({
      code: 'PRESCRIPTION_ALREADY_DISPENSED',
      message: 'This medication has already been dispensed.',
      statusCode: 409,
    });
  }

  const item = await InventoryItem.findOne({ _id: inventoryItemId, clinicId });
  if (!item) {
    throw new AppError({
      code: 'INVENTORY_ITEM_NOT_FOUND',
      message: 'Selected inventory item was not found.',
      statusCode: 404,
    });
  }

  const dispenseQuantity = quantity || prescription.quantity || 1;
  if (item.quantityOnHand < dispenseQuantity) {
    throw new AppError({
      code: 'INSUFFICIENT_STOCK',
      message: `Insufficient stock for "${item.name}". Available: ${item.quantityOnHand}, required: ${dispenseQuantity}.`,
      statusCode: 409,
    });
  }

  await runInTransaction(async (session) => {
    item.quantityOnHand -= dispenseQuantity;
    item.transactions.push({
      type: 'DISPENSE',
      quantity: dispenseQuantity,
      delta: -dispenseQuantity,
      reason: reason || `Prescription dispensing — ${prescription.medicine}`,
      actorId: req.user._id,
      at: new Date(),
    });
    await item.save(session ? { session } : {});

    prescription.dispensed = true;
    prescription.dispensedAt = new Date();
    prescription.dispensedBy = req.user._id;
    prescription.inventoryItemId = item._id;
    await encounter.save(session ? { session } : {});

    if (encounter.queueEntryId) {
      const queueEntry = await QueueEntry.findOne({ _id: encounter.queueEntryId, clinicId });
      if (queueEntry && queueEntry.state === QUEUE_STATES.PHARMACY_PENDING) {
        const hasMoreUndispensed = encounter.prescriptions.some((p) => !p.dispensed);
        if (!hasMoreUndispensed) {
          queueEntry.transitions.push({
            from: queueEntry.state,
            to: QUEUE_STATES.BILLING_PENDING,
            actorId: req.user._id,
            at: new Date(),
          });
          queueEntry.state = QUEUE_STATES.BILLING_PENDING;
          await queueEntry.save(session ? { session } : {});
        }
      }
    }
  });

  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'inventory.dispense_prescription',
    resourceType: 'inventory_item',
    resourceId: item.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: {
      medicine: prescription.medicine,
      quantity: dispenseQuantity,
      encounterId,
      prescriptionId,
    },
  });

  res.json({
    success: true,
    prescription: {
      id: prescription.id,
      medicine: prescription.medicine,
      dispensed: true,
      dispensedAt: prescription.dispensedAt,
    },
    item: {
      id: item.id,
      name: item.name,
      quantityOnHand: item.quantityOnHand,
    },
  });
}
