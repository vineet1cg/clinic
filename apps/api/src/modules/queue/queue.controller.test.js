import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QUEUE_STATES, USER_ROLES, USER_STATUSES } from '@clinicos/contracts';

const mocks = vi.hoisted(() => ({
  findQueueEntry: vi.fn(),
  findInvoiceAndUpdate: vi.fn(),
  findInvoice: vi.fn(),
  writeAuditEntry: vi.fn(),
  assertConsultationPaid: vi.fn(),
  ensureConsultationInvoice: vi.fn(),
  registerConsultationVisit: vi.fn(),
}));

vi.mock('../../models/queue-entry.model.js', () => ({
  QueueEntry: { findOne: mocks.findQueueEntry },
}));
vi.mock('../../models/invoice.model.js', () => ({
  Invoice: {
    findOneAndUpdate: mocks.findInvoiceAndUpdate,
    findOne: mocks.findInvoice,
  },
}));
vi.mock('../audit/audit.service.js', () => ({ writeAuditEntry: mocks.writeAuditEntry }));
vi.mock('../billing/consultation.service.js', () => ({
  assertConsultationPaid: mocks.assertConsultationPaid,
  ensureConsultationInvoice: mocks.ensureConsultationInvoice,
  registerConsultationVisit: mocks.registerConsultationVisit,
}));

import { transitionQueueEntry } from './queue.controller.js';

beforeEach(() => vi.clearAllMocks());

describe('payment-pending queue authorization', () => {
  it('prevents a queue manager without billing access from cancelling the visit', async () => {
    const clinicId = new mongoose.Types.ObjectId();
    const entry = {
      state: QUEUE_STATES.PAYMENT_PENDING,
      save: vi.fn(),
    };
    mocks.findQueueEntry.mockResolvedValue(entry);

    await expect(
      transitionQueueEntry(
        {
          user: {
            _id: new mongoose.Types.ObjectId(),
            clinicId,
            roles: [USER_ROLES.NURSE],
            status: USER_STATUSES.ACTIVE,
            additionalPermissions: [],
            deniedPermissions: [],
          },
          params: { id: new mongoose.Types.ObjectId().toString() },
          body: { state: QUEUE_STATES.CANCELLED },
        },
        {},
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });

    expect(entry.save).not.toHaveBeenCalled();
    expect(mocks.findInvoiceAndUpdate).not.toHaveBeenCalled();
  });
});
