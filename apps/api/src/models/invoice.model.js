import mongoose from 'mongoose';
import { INVOICE_STATUSES, PAYMENT_METHODS } from '@clinicos/contracts';
import { documentSchemaOptions } from '../db/schema-options.js';

const invoiceItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.01 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    reference: String,
    idempotencyKey: { type: String, maxlength: 128 },
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    collectedAt: { type: Date, default: Date.now },
  },
  {
    _id: true,
    toJSON: {
      transform: (_document, result) => {
        delete result.idempotencyKey;
        return result;
      },
    },
  },
);

const invoiceSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    invoiceNumber: { type: String, required: true },
    purpose: { type: String, enum: ['GENERAL', 'CONSULTATION'], default: 'GENERAL' },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    queueEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'QueueEntry' },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    items: { type: [invoiceItemSchema], required: true },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    balance: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(INVOICE_STATUSES),
      default: INVOICE_STATUSES.UNPAID,
      index: true,
    },
    payments: { type: [paymentSchema], default: [] },
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  documentSchemaOptions,
);

invoiceSchema.index({ clinicId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index(
  { clinicId: 1, 'payments.idempotencyKey': 1 },
  {
    name: 'invoice_payment_idempotency_unique',
    unique: true,
    partialFilterExpression: { 'payments.idempotencyKey': { $type: 'string' } },
  },
);
invoiceSchema.index(
  { clinicId: 1, queueEntryId: 1, purpose: 1 },
  {
    name: 'consultation_invoice_per_visit_unique',
    unique: true,
    partialFilterExpression: { queueEntryId: { $type: 'objectId' }, purpose: 'CONSULTATION' },
  },
);

export const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
