import { describe, expect, it } from 'vitest';
import { USER_ROLES, USER_STATUSES } from '@clinicos/contracts';
import {
  serializeAppointment,
  serializeEncounter,
  serializeQueueEntry,
} from './response-privacy.js';

function user(role) {
  return {
    roles: [role],
    additionalPermissions: [],
    deniedPermissions: [],
    status: USER_STATUSES.ACTIVE,
  };
}

describe('minimum necessary API responses', () => {
  it('hides visit context from billing-only staff', () => {
    const appointment = serializeAppointment(
      {
        reason: 'Sensitive visit reason',
        notes: 'Sensitive scheduling notes',
        clinicId: 'clinic-id',
      },
      user(USER_ROLES.BILLING_STAFF),
    );
    expect(appointment.reason).toBeUndefined();
    expect(appointment.notes).toBeUndefined();
    expect(appointment.clinicId).toBeUndefined();
  });

  it('always removes integration identifiers from queue responses', () => {
    const entry = serializeQueueEntry(
      { patientOpenemrId: 'external-id', reason: 'Follow-up' },
      user(USER_ROLES.RECEPTIONIST),
    );
    expect(entry.reason).toBe('Follow-up');
    expect(entry.patientOpenemrId).toBeUndefined();
  });

  it('filters clinical sections by their granular view permissions', () => {
    const encounter = serializeEncounter(
      {
        diagnoses: ['Private diagnosis'],
        prescriptions: [{ medicine: 'Example' }],
        vitals: { pulseBpm: 70, recordedBy: 'internal-user-id' },
      },
      user(USER_ROLES.NURSE),
    );

    expect(encounter.diagnoses).toBeUndefined();
    expect(encounter.prescriptions).toHaveLength(1);
    expect(encounter.vitals.pulseBpm).toBe(70);
    expect(encounter.vitals.recordedBy).toBeUndefined();
  });
});
