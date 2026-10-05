import { ENCOUNTER_STATUSES, PERMISSIONS, QUEUE_STATES } from '@clinicos/contracts';
import { AppError } from '../../common/app-error.js';
import { getClinicId } from '../../common/clinic-context.js';
import { serializeEncounter, serializeQueueEntry } from '../../common/response-privacy.js';
import { Encounter } from '../../models/encounter.model.js';
import { QueueEntry } from '../../models/queue-entry.model.js';
import { writeAuditEntry } from '../audit/audit.service.js';
import { resolvePermissions } from '../auth/auth.service.js';
import { assertConsultationPaid } from '../billing/consultation.service.js';

const encounterPopulation = [
  { path: 'patientId', select: 'patientNumber fullName mobile gender dateOfBirth age bloodGroup' },
  { path: 'doctorId', select: 'name roles' },
  { path: 'queueEntryId', select: 'tokenNumber queueDate state reason priority transitions' },
];

async function findEncounterOrThrow(clinicId, id) {
  const encounter = await Encounter.findOne({ _id: id, clinicId });
  if (!encounter) {
    throw new AppError({
      code: 'ENCOUNTER_NOT_FOUND',
      message: 'Consultation was not found.',
      statusCode: 404,
    });
  }
  return encounter;
}

function assertAssignedDoctor(user, doctorId) {
  const canOverride = resolvePermissions(user).includes(PERMISSIONS.QUEUE_OVERRIDE);
  if (doctorId?.toString() !== user._id.toString() && !canOverride) {
    throw new AppError({
      code: 'ENCOUNTER_DOCTOR_MISMATCH',
      message: 'Only the assigned doctor can change this consultation.',
      statusCode: 403,
    });
  }
}

export async function getEncounterByQueue(req, res) {
  const clinicId = getClinicId(req.user);
  const [queueEntry, encounter] = await Promise.all([
    QueueEntry.findOne({ _id: req.params.queueId, clinicId }).populate([
      {
        path: 'patientId',
        select: 'patientNumber fullName mobile gender dateOfBirth age bloodGroup',
      },
      { path: 'doctorId', select: 'name roles' },
    ]),
    Encounter.findOne({ queueEntryId: req.params.queueId, clinicId }).populate(encounterPopulation),
  ]);
  if (!queueEntry) {
    throw new AppError({
      code: 'QUEUE_ENTRY_NOT_FOUND',
      message: 'Queue entry was not found.',
      statusCode: 404,
    });
  }
  if (queueEntry.state === QUEUE_STATES.PAYMENT_PENDING) {
    throw new AppError({
      code: 'CONSULTATION_FEE_UNPAID',
      message: 'Collect the consultation fee before opening the doctor workspace.',
      statusCode: 409,
    });
  }
  res.json({
    queueEntry: serializeQueueEntry(queueEntry, req.user),
    encounter: encounter ? serializeEncounter(encounter, req.user) : null,
  });
}

export async function createEncounter(req, res) {
  const clinicId = getClinicId(req.user);
  const existing = await Encounter.findOne({
    queueEntryId: req.body.queueEntryId,
    clinicId,
  }).populate(encounterPopulation);
  if (existing) {
    assertAssignedDoctor(req.user, existing.doctorId?._id || existing.doctorId);
    return res.json({ encounter: serializeEncounter(existing, req.user) });
  }

  const queueEntry = await QueueEntry.findOne({ _id: req.body.queueEntryId, clinicId });
  if (!queueEntry) {
    throw new AppError({
      code: 'QUEUE_ENTRY_NOT_FOUND',
      message: 'Queue entry was not found.',
      statusCode: 404,
    });
  }
  if (queueEntry.state !== QUEUE_STATES.READY_FOR_DOCTOR) {
    throw new AppError({
      code: 'PATIENT_NOT_READY_FOR_DOCTOR',
      message: 'Move the patient to Ready for doctor before starting consultation.',
      statusCode: 409,
    });
  }
  await assertConsultationPaid(queueEntry);
  assertAssignedDoctor(req.user, queueEntry.doctorId);

  queueEntry.transitions.push({
    from: queueEntry.state,
    to: QUEUE_STATES.IN_CONSULTATION,
    actorId: req.user._id,
    at: new Date(),
  });
  queueEntry.state = QUEUE_STATES.IN_CONSULTATION;
  queueEntry.consultationStartedAt = new Date();
  await queueEntry.save();

  const encounter = await Encounter.create({
    clinicId,
    queueEntryId: queueEntry._id,
    patientId: queueEntry.patientId,
    doctorId: queueEntry.doctorId,
    createdBy: req.user._id,
  });
  await encounter.populate(encounterPopulation);
  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'encounter.create',
    resourceType: 'encounter',
    resourceId: encounter.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.status(201).json({ encounter: serializeEncounter(encounter, req.user) });
}

export async function updateEncounter(req, res) {
  const clinicId = getClinicId(req.user);
  const encounter = await findEncounterOrThrow(clinicId, req.params.id);
  assertAssignedDoctor(req.user, encounter.doctorId);
  if (encounter.status === ENCOUNTER_STATUSES.COMPLETED) {
    throw new AppError({
      code: 'ENCOUNTER_COMPLETED',
      message: 'Completed consultations are read-only.',
      statusCode: 409,
    });
  }
  Object.assign(encounter, req.body, { updatedBy: req.user._id });
  await encounter.save();
  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'encounter.update',
    resourceType: 'encounter',
    resourceId: encounter.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { fields: Object.keys(req.body) },
  });
  await encounter.populate(encounterPopulation);
  res.json({ encounter: serializeEncounter(encounter, req.user) });
}

export async function recordVitals(req, res) {
  const clinicId = getClinicId(req.user);
  const encounter = await findEncounterOrThrow(clinicId, req.params.id);
  if (encounter.status === ENCOUNTER_STATUSES.COMPLETED) {
    throw new AppError({
      code: 'ENCOUNTER_COMPLETED',
      message: 'Completed consultations are read-only.',
      statusCode: 409,
    });
  }
  encounter.vitals = { ...req.body, recordedBy: req.user._id, recordedAt: new Date() };
  encounter.updatedBy = req.user._id;
  await encounter.save();
  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'vitals.record',
    resourceType: 'encounter',
    resourceId: encounter.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.json({ encounter: serializeEncounter(encounter, req.user) });
}

export async function completeEncounter(req, res) {
  const clinicId = getClinicId(req.user);
  const encounter = await findEncounterOrThrow(clinicId, req.params.id);
  assertAssignedDoctor(req.user, encounter.doctorId);
  if (!encounter.chiefComplaint || !encounter.assessment) {
    throw new AppError({
      code: 'ENCOUNTER_INCOMPLETE',
      message: 'Chief complaint and assessment are required before completion.',
      statusCode: 422,
    });
  }
  encounter.status = ENCOUNTER_STATUSES.COMPLETED;
  encounter.completedAt = new Date();
  encounter.updatedBy = req.user._id;
  await encounter.save();

  const queueEntry = await QueueEntry.findOne({ _id: encounter.queueEntryId, clinicId });
  if (queueEntry?.state === QUEUE_STATES.IN_CONSULTATION) {
    queueEntry.transitions.push({
      from: queueEntry.state,
      to: QUEUE_STATES.CONSULTATION_COMPLETE,
      actorId: req.user._id,
      at: new Date(),
    });
    queueEntry.state = QUEUE_STATES.CONSULTATION_COMPLETE;
    queueEntry.consultationCompletedAt = new Date();
    await queueEntry.save();
  }

  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'encounter.complete',
    resourceType: 'encounter',
    resourceId: encounter.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: {
      handoff: 'RECEPTION',
      queueState: QUEUE_STATES.CONSULTATION_COMPLETE,
    },
  });
  await encounter.populate(encounterPopulation);
  res.json({ encounter: serializeEncounter(encounter, req.user) });
}
