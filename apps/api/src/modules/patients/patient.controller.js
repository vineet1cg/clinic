import { PERMISSIONS } from '@clinicos/contracts';
import { getClinicId } from '../../common/clinic-context.js';
import { AppError } from '../../common/app-error.js';
import { serializeAppointment, serializeEncounter } from '../../common/response-privacy.js';
import { Appointment } from '../../models/appointment.model.js';
import { Encounter } from '../../models/encounter.model.js';
import { Invoice } from '../../models/invoice.model.js';
import { Patient } from '../../models/patient.model.js';
import { writeAuditEntry } from '../audit/audit.service.js';
import { resolvePermissions } from '../auth/auth.service.js';
import { createPatientRecord, searchPatientRecords } from './patient.service.js';

export async function searchPatients(req, res) {
  const { query, limit } = req.validated.query;
  const clinicId = getClinicId(req.user);
  const patients = await searchPatientRecords(clinicId, query, limit);
  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'patient.search',
    resourceType: 'patient',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { resultCount: patients.length },
  });
  res.json({ patients });
}

export async function createPatient(req, res) {
  const clinicId = getClinicId(req.user);
  const patient = await createPatientRecord({ clinicId, actorId: req.user._id, input: req.body });
  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'patient.create',
    resourceType: 'patient',
    resourceId: patient.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { source: patient.source },
  });
  res.status(201).json({ patient });
}

export async function getPatient(req, res) {
  const clinicId = getClinicId(req.user);
  const permissions = resolvePermissions(req.user);
  const access = {
    appointments: permissions.includes(PERMISSIONS.APPOINTMENT_VIEW),
    encounters: permissions.includes(PERMISSIONS.ENCOUNTER_VIEW),
    billing: permissions.includes(PERMISSIONS.BILLING_VIEW),
  };
  const patient = await Patient.findOne({ _id: req.params.id, clinicId });
  if (!patient) {
    throw new AppError({
      code: 'PATIENT_NOT_FOUND',
      message: 'Patient was not found.',
      statusCode: 404,
    });
  }

  const [appointments, encounters, invoices] = await Promise.all([
    access.appointments
      ? Appointment.find({ clinicId, patientId: patient._id })
          .populate('doctorId', 'name')
          .sort({ date: -1, time: -1 })
          .limit(20)
      : [],
    access.encounters
      ? Encounter.find({ clinicId, patientId: patient._id })
          .populate('doctorId', 'name')
          .sort({ createdAt: -1 })
          .limit(20)
      : [],
    access.billing
      ? Invoice.find({ clinicId, patientId: patient._id }).sort({ createdAt: -1 }).limit(20)
      : [],
  ]);

  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'patient.view',
    resourceType: 'patient',
    resourceId: patient.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: {
      sections: Object.entries(access)
        .filter(([, allowed]) => allowed)
        .map(([name]) => name),
    },
  });
  res.json({
    patient,
    appointments: appointments.map((appointment) => serializeAppointment(appointment, req.user)),
    encounters: encounters.map((encounter) => serializeEncounter(encounter, req.user)),
    invoices,
    access,
  });
}

export async function updatePatient(req, res) {
  const clinicId = getClinicId(req.user);
  const update = { ...req.body, updatedBy: req.user._id };
  if (update.fullName) update.normalizedName = update.fullName.toLowerCase().replace(/\s+/g, ' ');
  if (update.mobile) update.normalizedMobile = update.mobile.replace(/\D/g, '');

  const patient = await Patient.findOneAndUpdate({ _id: req.params.id, clinicId }, update, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!patient) {
    throw new AppError({
      code: 'PATIENT_NOT_FOUND',
      message: 'Patient was not found.',
      statusCode: 404,
    });
  }

  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'patient.update',
    resourceType: 'patient',
    resourceId: patient.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { fields: Object.keys(req.body) },
  });
  res.json({ patient });
}
