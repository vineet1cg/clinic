import { describe, expect, it } from 'vitest';
import { Patient } from './patient.model.js';
import { Invoice } from './invoice.model.js';
import { QueueEntry } from './queue-entry.model.js';

function optionsFor(schema, field) {
  return schema.indexes().find(([keys]) => keys.clinicId === 1 && keys[field] === 1)?.[1];
}

describe('optional tenant-scoped unique indexes', () => {
  it('indexes OpenEMR patient IDs only when a string ID exists', () => {
    expect(optionsFor(Patient.schema, 'openemrPatientId')).toMatchObject({
      unique: true,
      partialFilterExpression: { openemrPatientId: { $type: 'string' } },
    });
  });

  it('indexes queue appointment IDs only when an ObjectId exists', () => {
    expect(optionsFor(QueueEntry.schema, 'appointmentId')).toMatchObject({
      unique: true,
      partialFilterExpression: { appointmentId: { $type: 'objectId' } },
    });
  });

  it('allows only one walk-in registration per clinic and idempotency key', () => {
    expect(optionsFor(QueueEntry.schema, 'registrationKey')).toMatchObject({
      unique: true,
      partialFilterExpression: { registrationKey: { $type: 'string' } },
    });
  });

  it('allows only one consultation invoice per visit', () => {
    expect(optionsFor(Invoice.schema, 'queueEntryId')).toMatchObject({
      unique: true,
      partialFilterExpression: { queueEntryId: { $type: 'objectId' }, purpose: 'CONSULTATION' },
    });
  });
});
