import { nextSequence } from '../../models/counter.model.js';
import { Patient } from '../../models/patient.model.js';
import { AppError } from '../../common/app-error.js';
import { calculateAge } from '@clinicos/contracts';
import { clinicToday } from '../../common/clinic-time.js';

function normalizePhone(value) {
  return value.replace(/\D/g, '');
}

function normalizeName(value) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function findDuplicatePatients(clinicId, input) {
  const alternatives = [{ normalizedMobile: normalizePhone(input.mobile) }];
  if (input.dateOfBirth) {
    alternatives.push({
      normalizedName: normalizeName(input.fullName),
      dateOfBirth: input.dateOfBirth,
    });
  }

  return Patient.find({ clinicId, $or: alternatives })
    .select('patientNumber fullName mobile dateOfBirth age gender')
    .limit(10);
}

export async function createPatientRecord({ clinicId, actorId, input }) {
  if (input.dateOfBirth) {
    const age = calculateAge(input.dateOfBirth, await clinicToday(clinicId));
    if (age === undefined || age > 130)
      throw new AppError({
        code: 'INVALID_DATE_OF_BIRTH',
        message: 'Enter a valid date of birth, not in the future, within the last 130 years.',
        statusCode: 422,
      });
    input = { ...input, age };
  }
  const duplicates = await findDuplicatePatients(clinicId, input);
  if (duplicates.length && !input.allowDuplicate) {
    throw new AppError({
      code: 'POSSIBLE_DUPLICATE_PATIENT',
      message:
        'Possible existing patient found. Review the matches before creating another record.',
      statusCode: 409,
      details: duplicates.map((patient) => patient.toJSON()),
    });
  }

  const sequence = await nextSequence(`${clinicId}:patient`);
  return Patient.create({
    ...input,
    allowDuplicate: undefined,
    patientNumber: `PT${String(sequence).padStart(6, '0')}`,
    clinicId,
    source: 'CLINICOS_LOCAL',
    normalizedName: normalizeName(input.fullName),
    normalizedMobile: normalizePhone(input.mobile),
    duplicateReason: input.allowDuplicate ? input.duplicateReason : undefined,
    createdBy: actorId,
  });
}

export async function searchPatientRecords(clinicId, query, limit) {
  const escaped = escapeRegex(query);
  const normalizedPhone = normalizePhone(query);
  const conditions = [
    { patientNumber: new RegExp(`^${escaped}`, 'i') },
    { fullName: new RegExp(escaped, 'i') },
    { dateOfBirth: query },
  ];
  if (normalizedPhone.length >= 4)
    conditions.unshift({ normalizedMobile: new RegExp(`${normalizedPhone}$`) });

  return Patient.find({ clinicId, $or: conditions })
    .select('patientNumber fullName mobile dateOfBirth age gender bloodGroup')
    .sort({ updatedAt: -1 })
    .limit(limit);
}
