import { APPOINTMENT_STATUSES, USER_ROLES, USER_STATUSES } from '@clinicos/contracts';
import { AppError } from '../../common/app-error.js';
import { getClinicId } from '../../common/clinic-context.js';
import { clinicToday } from '../../common/clinic-time.js';
import { env } from '../../config/env.js';
import { serializeAppointment, serializeQueueEntry } from '../../common/response-privacy.js';
import { Appointment } from '../../models/appointment.model.js';
import { nextSequence } from '../../models/counter.model.js';
import { ClinicSettings } from '../../models/clinic-settings.model.js';
import { Patient } from '../../models/patient.model.js';
import { User } from '../../models/user.model.js';
import { writeAuditEntry } from '../audit/audit.service.js';
import {
  registerConsultationVisit,
  resolveConsultationFee,
} from '../billing/consultation.service.js';

const appointmentPopulation = [
  { path: 'patientId', select: 'patientNumber fullName mobile' },
  { path: 'doctorId', select: 'name roles' },
];

export async function listDoctors(req, res) {
  const clinicId = getClinicId(req.user);
  const settings = await ClinicSettings.findOne({ clinicId }).select(
    'defaultConsultationFee timezone',
  );
  const doctors = await User.find({
    clinicId,
    roles: { $in: [USER_ROLES.DOCTOR, USER_ROLES.SUPER_ADMIN] },
    status: USER_STATUSES.ACTIVE,
  })
    .select('name roles consultationFee')
    .sort({ name: 1 });
  res.json({
    timeZone: settings?.timezone || env.CLINIC_TIMEZONE,
    doctors: doctors.map((doctor) => ({
      id: doctor.id,
      name: doctor.name,
      roles: doctor.roles,
      consultationFee: resolveConsultationFee(doctor, settings),
    })),
  });
}

export async function listAppointments(req, res) {
  const clinicId = getClinicId(req.user);
  const { date, from, to, doctorId, status } = req.validated.query;
  const filter = { clinicId };
  if (date) filter.date = date;
  else if (from || to)
    filter.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  if (doctorId) filter.doctorId = doctorId;
  if (status) filter.status = status;
  const appointments = await Appointment.find(filter)
    .populate(appointmentPopulation)
    .sort({ date: 1, time: 1 })
    .limit(500);
  res.json({
    appointments: appointments.map((appointment) => serializeAppointment(appointment, req.user)),
  });
}

export async function createAppointment(req, res) {
  const clinicId = getClinicId(req.user);
  const [patient, doctor] = await Promise.all([
    Patient.findOne({ _id: req.body.patientId, clinicId }),
    User.findOne({
      _id: req.body.doctorId,
      clinicId,
      roles: { $in: [USER_ROLES.DOCTOR, USER_ROLES.SUPER_ADMIN] },
      status: USER_STATUSES.ACTIVE,
    }),
  ]);
  if (!patient)
    throw new AppError({
      code: 'PATIENT_NOT_FOUND',
      message: 'Patient was not found.',
      statusCode: 404,
    });
  if (!doctor)
    throw new AppError({
      code: 'DOCTOR_NOT_FOUND',
      message: 'Select an active doctor.',
      statusCode: 404,
    });

  const sequence = await nextSequence(`${clinicId}:appointment`);
  const appointment = await Appointment.create({
    ...req.body,
    clinicId,
    appointmentNumber: `AP${String(sequence).padStart(6, '0')}`,
    createdBy: req.user._id,
  });
  await appointment.populate(appointmentPopulation);
  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'appointment.create',
    resourceType: 'appointment',
    resourceId: appointment.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.status(201).json({ appointment: serializeAppointment(appointment, req.user) });
}

export async function cancelAppointment(req, res) {
  const clinicId = getClinicId(req.user);
  const appointment = await Appointment.findOne({ _id: req.params.id, clinicId });
  if (!appointment)
    throw new AppError({
      code: 'APPOINTMENT_NOT_FOUND',
      message: 'Appointment was not found.',
      statusCode: 404,
    });
  if (appointment.status === APPOINTMENT_STATUSES.CHECKED_IN) {
    throw new AppError({
      code: 'APPOINTMENT_ALREADY_CHECKED_IN',
      message: 'Manage this visit from the queue.',
      statusCode: 409,
    });
  }
  appointment.status = APPOINTMENT_STATUSES.CANCELLED;
  appointment.cancellationReason = req.body.reason;
  appointment.updatedBy = req.user._id;
  await appointment.save();
  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'appointment.cancel',
    resourceType: 'appointment',
    resourceId: appointment.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { status: APPOINTMENT_STATUSES.CANCELLED },
  });
  res.json({ appointment: serializeAppointment(appointment, req.user) });
}

export async function checkInAppointment(req, res) {
  const clinicId = getClinicId(req.user);
  const appointment = await Appointment.findOne({ _id: req.params.id, clinicId });
  if (!appointment)
    throw new AppError({
      code: 'APPOINTMENT_NOT_FOUND',
      message: 'Appointment was not found.',
      statusCode: 404,
    });
  if (appointment.status === APPOINTMENT_STATUSES.CANCELLED) {
    throw new AppError({
      code: 'APPOINTMENT_CANCELLED',
      message: 'A cancelled appointment cannot be checked in.',
      statusCode: 409,
    });
  }
  const today = await clinicToday(clinicId);
  if (appointment.date !== today) {
    throw new AppError({
      code: 'APPOINTMENT_NOT_TODAY',
      message: 'Only appointments scheduled for today can be checked in.',
      statusCode: 409,
    });
  }
  const { queueEntry, invoice } = await registerConsultationVisit({
    clinicId,
    actorId: req.user._id,
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    reason: appointment.reason,
    appointment,
    queueDate: appointment.date,
    requestContext: { ipAddress: req.ip, userAgent: req.get('user-agent') },
  });
  if (appointment.status !== APPOINTMENT_STATUSES.CHECKED_IN) {
    appointment.status = APPOINTMENT_STATUSES.CHECKED_IN;
    appointment.updatedBy = req.user._id;
    await appointment.save();
  }
  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'appointment.check_in',
    resourceType: 'appointment',
    resourceId: appointment.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { queueEntryId: queueEntry.id },
  });
  res.json({
    appointment: serializeAppointment(appointment, req.user),
    queueEntry: serializeQueueEntry(queueEntry, req.user),
    consultationInvoice: invoice,
  });
}
