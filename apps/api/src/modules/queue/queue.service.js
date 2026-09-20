import { QUEUE_STATES, USER_ROLES, USER_STATUSES } from '@clinicos/contracts';
import { AppError } from '../../common/app-error.js';
import { clinicToday } from '../../common/clinic-time.js';
import { nextSequence } from '../../models/counter.model.js';
import { Patient } from '../../models/patient.model.js';
import { QueueEntry } from '../../models/queue-entry.model.js';
import { User } from '../../models/user.model.js';

export async function createQueueEntry({
  clinicId,
  actorId,
  patientId,
  doctorId,
  reason,
  priority = 0,
  appointment,
  queueDate,
  consultationFee,
  registrationKey,
}) {
  function assertSameVisit(existing) {
    if (
      existing.patientId?.toString() !== patientId.toString() ||
      existing.doctorId?.toString() !== doctorId.toString()
    ) {
      throw new AppError({
        code: 'VISIT_REGISTRATION_KEY_CONFLICT',
        message: 'This registration key was already used for another visit.',
        statusCode: 409,
      });
    }
    return existing;
  }
  const effectiveQueueDate = queueDate || (await clinicToday(clinicId));
  if (appointment || registrationKey) {
    const existing = await QueueEntry.findOne({
      clinicId,
      ...(appointment ? { appointmentId: appointment._id } : { registrationKey }),
    });
    if (existing) return assertSameVisit(existing);
  }
  if (!Number.isFinite(consultationFee) || consultationFee <= 0) {
    throw new AppError({
      code: 'CONSULTATION_FEE_NOT_CONFIGURED',
      message: 'Set a positive consultation fee before registering this visit.',
      statusCode: 409,
    });
  }

  const [patient, doctor] = await Promise.all([
    Patient.findOne({ _id: patientId, clinicId }),
    User.findOne({
      _id: doctorId,
      clinicId,
      status: USER_STATUSES.ACTIVE,
      roles: { $in: [USER_ROLES.DOCTOR, USER_ROLES.SUPER_ADMIN] },
    }),
  ]);
  if (!patient) {
    throw new AppError({
      code: 'PATIENT_NOT_FOUND',
      message: 'Patient was not found.',
      statusCode: 404,
    });
  }
  if (!doctor) {
    throw new AppError({
      code: 'DOCTOR_NOT_FOUND',
      message: 'Select an active doctor.',
      statusCode: 404,
    });
  }

  const tokenNumber = await nextSequence(`${clinicId}:queue:${effectiveQueueDate}`);
  const input = {
    clinicId,
    patientId: patient._id,
    patientOpenemrId: patient.openemrPatientId,
    doctorId: doctor._id,
    doctorOpenemrId: doctor.openemrUserId,
    appointmentId: appointment?._id,
    registrationKey,
    paymentRequired: true,
    consultationFee,
    appointmentOpenemrId: appointment?.openemrAppointmentId,
    reason,
    priority,
    tokenNumber,
    queueDate: effectiveQueueDate,
    state: QUEUE_STATES.PAYMENT_PENDING,
    createdBy: actorId,
    transitions: [{ to: QUEUE_STATES.PAYMENT_PENDING, actorId, at: new Date() }],
  };
  try {
    return await QueueEntry.create(input);
  } catch (error) {
    if (error?.code === 11000 && (appointment || registrationKey)) {
      const existing = await QueueEntry.findOne({
        clinicId,
        ...(appointment ? { appointmentId: appointment._id } : { registrationKey }),
      });
      if (existing) return assertSameVisit(existing);
    }
    throw error;
  }
}
