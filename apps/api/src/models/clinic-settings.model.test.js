import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { ClinicSettings } from './clinic-settings.model.js';

function settings(overrides = {}) {
  return new ClinicSettings({
    clinicId: new mongoose.Types.ObjectId(),
    clinicName: 'Maitri Clinic',
    ...overrides,
  });
}

describe('ClinicSettings model validation', () => {
  it('normalizes the same fields normalized by the shared settings contract', async () => {
    const document = settings({
      clinicName: '  Maitri Clinic  ',
      address: '  Main Road  ',
      phone: '  +919876543210  ',
      currency: ' inr ',
      timezone: ' Asia/Kolkata ',
      tokenPrefix: ' op ',
    });

    await expect(document.validate()).resolves.toBeUndefined();
    expect(document).toMatchObject({
      clinicName: 'Maitri Clinic',
      address: 'Main Road',
      phone: '+919876543210',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      tokenPrefix: 'OP',
    });
  });

  it.each([
    ['clinicName', 'X'],
    ['address', 'x'.repeat(501)],
    ['phone', '01234567'],
    ['currency', 'RUPEE'],
    ['timezone', 'Mars/Olympus'],
    ['tokenPrefix', 'TOO-LONG-1'],
    ['defaultConsultationFee', -1],
    ['defaultConsultationFee', 10.001],
    ['language', 'fr'],
    ['receiptFormat', 'LETTER'],
    ['prescriptionFooter', 'x'.repeat(501)],
    ['invoiceFooter', 'x'.repeat(501)],
  ])('rejects an invalid %s value', async (field, value) => {
    let error;
    try {
      await settings({ [field]: value }).validate();
    } catch (caught) {
      error = caught;
    }

    expect(error?.errors[field]).toBeDefined();
  });
});
