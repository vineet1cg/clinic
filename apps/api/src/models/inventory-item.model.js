import mongoose from 'mongoose';
import { INVENTORY_TRANSACTION_TYPES } from '@clinicos/contracts';
import { documentSchemaOptions } from '../db/schema-options.js';

const transactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: INVENTORY_TRANSACTION_TYPES, required: true },
    quantity: { type: Number, required: true },
    delta: { type: Number, required: true },
    reason: { type: String, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, required: true },
    at: { type: Date, default: Date.now },
  },
  {
    _id: true,
    toJSON: {
      transform: (_document, result) => {
        delete result.actorId;
        return result;
      },
    },
  },
);

const inventoryItemSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    genericName: String,
    sku: { type: String, required: true, uppercase: true },
    batchNumber: String,
    expiryDate: String,
    reorderLevel: { type: Number, default: 0 },
    unit: { type: String, default: 'unit' },
    quantityOnHand: { type: Number, default: 0 },
    transactions: { type: [transactionSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  documentSchemaOptions,
);

inventoryItemSchema.index({ clinicId: 1, sku: 1 }, { unique: true });

export const InventoryItem =
  mongoose.models.InventoryItem || mongoose.model('InventoryItem', inventoryItemSchema);
