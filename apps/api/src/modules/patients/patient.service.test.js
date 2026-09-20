import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({ env: { OPENEMR_ENABLED: false } }));
vi.mock('../../integrations/openemr/patients.js', () => ({ createPatient: vi.fn() }));
vi.mock('../../common/clinic-time.js', () => ({ clinicToday: vi.fn(async () => '2026-09-20') }));
vi.mock('../../models/counter.model.js', () => ({ nextSequence: vi.fn(async () => 1) }));
vi.mock('../../models/patient.model.js', () => ({
  Patient: { find: vi.fn(), create: vi.fn(async (value) => value) },
}));

import { Patient } from '../../models/patient.model.js';
import { createPatientRecord } from './patient.service.js';

const input = {
  fullName: 'Demo Patient',
  mobile: '+919000000000',
  gender: 'FEMALE',
  dateOfBirth: '2000-09-20',
  age: 99,
};
beforeEach(() => {
  vi.clearAllMocks();
  Patient.find.mockReturnValue({ select: () => ({ limit: async () => [] }) });
});
describe('patient birth date and age', () => {
  it('calculates age on the server rather than trusting a supplied age', async () => {
    const record = await createPatientRecord({ clinicId: 'clinic', actorId: 'actor', input });
    expect(record.age).toBe(26);
    expect(record.dateOfBirth).toBe('2000-09-20');
  });
  it('rejects a future birth date before persistence', async () => {
    await expect(
      createPatientRecord({
        clinicId: 'clinic',
        actorId: 'actor',
        input: { ...input, dateOfBirth: '2026-09-21' },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_DATE_OF_BIRTH' });
    expect(Patient.create).not.toHaveBeenCalled();
  });
  it('retains age-only registration without inventing a date of birth', async () => {
    const record = await createPatientRecord({
      clinicId: 'clinic',
      actorId: 'actor',
      input: { ...input, dateOfBirth: undefined, age: 30 },
    });
    expect(record.age).toBe(30);
    expect(record.dateOfBirth).toBeUndefined();
  });
});
