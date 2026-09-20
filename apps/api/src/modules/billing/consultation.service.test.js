import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Invoice } from '../../models/invoice.model.js';
import { assertConsultationPaid, resolveConsultationFee } from './consultation.service.js';

afterEach(() => vi.restoreAllMocks());

describe('previsit consultation fee', () => {
  it('uses the doctor override, otherwise the clinic default', () => {
    expect(resolveConsultationFee({ consultationFee: 750 }, { defaultConsultationFee: 500 })).toBe(
      750,
    );
    expect(resolveConsultationFee({ consultationFee: null }, { defaultConsultationFee: 500 })).toBe(
      500,
    );
    expect(resolveConsultationFee({ consultationFee: 0 }, { defaultConsultationFee: 500 })).toBe(
      500,
    );
    expect(resolveConsultationFee({ consultationFee: null }, null)).toBe(0);
  });

  it('blocks an unpaid consultation invoice', async () => {
    vi.spyOn(Invoice, 'exists').mockResolvedValue(null);
    await expect(
      assertConsultationPaid({
        _id: new mongoose.Types.ObjectId(),
        clinicId: new mongoose.Types.ObjectId(),
        consultationInvoiceId: new mongoose.Types.ObjectId(),
        paymentRequired: true,
      }),
    ).rejects.toMatchObject({ code: 'CONSULTATION_FEE_UNPAID', statusCode: 409 });
  });

  it('accepts only a paid invoice tied to the visit and clinic', async () => {
    const exists = vi
      .spyOn(Invoice, 'exists')
      .mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    const visit = {
      _id: new mongoose.Types.ObjectId(),
      clinicId: new mongoose.Types.ObjectId(),
      consultationInvoiceId: new mongoose.Types.ObjectId(),
      paymentRequired: true,
    };
    await expect(assertConsultationPaid(visit)).resolves.toBeUndefined();
    expect(exists).toHaveBeenCalledWith({
      _id: visit.consultationInvoiceId,
      clinicId: visit.clinicId,
      queueEntryId: visit._id,
      purpose: 'CONSULTATION',
      status: 'PAID',
      balance: 0,
    });
  });
});
