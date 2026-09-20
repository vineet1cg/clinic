import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { Invoice } from './invoice.model.js';

describe('Invoice response serialization', () => {
  it('never exposes payment idempotency keys', () => {
    const invoice = new Invoice({
      clinicId: new mongoose.Types.ObjectId(),
      invoiceNumber: 'INV000001',
      patientId: new mongoose.Types.ObjectId(),
      items: [{ description: 'Consultation', quantity: 1, rate: 500, amount: 500 }],
      subtotal: 500,
      total: 500,
      balance: 0,
      paidAmount: 500,
      status: 'PAID',
      payments: [
        {
          amount: 500,
          method: 'CASH',
          idempotencyKey: 'test-payment-key-12345',
          collectedBy: new mongoose.Types.ObjectId(),
        },
      ],
      createdBy: new mongoose.Types.ObjectId(),
    });

    const serialized = invoice.toJSON();
    expect(serialized.payments[0].idempotencyKey).toBeUndefined();
    expect(serialized.clinicId).toBeUndefined();
    expect(serialized.createdBy).toBeUndefined();
  });
});
