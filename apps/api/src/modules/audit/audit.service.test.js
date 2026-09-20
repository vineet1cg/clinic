import { describe, expect, it } from 'vitest';
import { sanitizeAuditMetadata } from './audit.service.js';

describe('sanitizeAuditMetadata', () => {
  it('keeps bounded operational metadata', () => {
    expect(
      sanitizeAuditMetadata({
        status: 'COMPLETED',
        fields: ['name', 'phone'],
        resultCount: 2,
      }),
    ).toEqual({ status: 'COMPLETED', fields: ['name', 'phone'], resultCount: 2 });
  });

  it('drops unknown fields and free-text reasons that may contain clinical data', () => {
    expect(
      sanitizeAuditMetadata({
        patientName: 'Sensitive Name',
        notes: 'Sensitive note',
        reason: 'Patient described symptoms here',
      }),
    ).toEqual({});
  });
});
