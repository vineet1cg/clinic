import { PERMISSIONS } from '@clinicos/contracts';
import { resolvePermissions } from '../modules/auth/auth.service.js';

function toJson(document) {
  return typeof document?.toJSON === 'function' ? document.toJSON() : { ...document };
}

export function canViewVisitContext(user) {
  const permissions = resolvePermissions(user);
  return (
    permissions.includes(PERMISSIONS.ENCOUNTER_VIEW) ||
    permissions.includes(PERMISSIONS.PATIENT_UPDATE)
  );
}

export function serializeAppointment(document, user) {
  const appointment = toJson(document);
  delete appointment.clinicId;
  delete appointment.createdBy;
  delete appointment.updatedBy;
  delete appointment.openemrAppointmentId;
  if (!canViewVisitContext(user)) {
    delete appointment.reason;
    delete appointment.notes;
    delete appointment.referralSource;
    delete appointment.cancellationReason;
  }
  return appointment;
}

export function serializeQueueEntry(document, user) {
  const entry = toJson(document);
  delete entry.clinicId;
  delete entry.createdBy;
  delete entry.patientOpenemrId;
  delete entry.doctorOpenemrId;
  delete entry.appointmentOpenemrId;
  delete entry.encounterOpenemrId;
  delete entry.transitions;
  delete entry.registrationKey;
  if (!resolvePermissions(user).includes(PERMISSIONS.BILLING_VIEW)) {
    delete entry.consultationFee;
    delete entry.consultationInvoiceId;
  }
  if (!canViewVisitContext(user)) delete entry.reason;
  return entry;
}

export function serializeEncounter(document, user) {
  const encounter = toJson(document);
  const permissions = resolvePermissions(user);
  delete encounter.clinicId;
  delete encounter.createdBy;
  delete encounter.updatedBy;

  if (encounter.queueEntryId && typeof encounter.queueEntryId === 'object') {
    encounter.queueEntryId = serializeQueueEntry(encounter.queueEntryId, user);
  }
  if (!permissions.includes(PERMISSIONS.VITALS_VIEW)) {
    delete encounter.vitals;
  } else if (encounter.vitals) {
    delete encounter.vitals.recordedBy;
  }
  if (!permissions.includes(PERMISSIONS.DIAGNOSIS_VIEW)) delete encounter.diagnoses;
  if (!permissions.includes(PERMISSIONS.PRESCRIPTION_VIEW)) delete encounter.prescriptions;

  return encounter;
}
