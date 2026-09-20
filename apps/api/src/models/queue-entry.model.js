import mongoose from 'mongoose';
import { QUEUE_STATES } from '@clinicos/contracts';
import { documentSchemaOptions } from '../db/schema-options.js';

const transitionSchema = new mongoose.Schema(
  {
    from: { type: String, enum: Object.values(QUEUE_STATES) },
    to: { type: String, required: true, enum: Object.values(QUEUE_STATES) },
    actorId: mongoose.Schema.Types.ObjectId,
    reason: { type: String, maxlength: 300 },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const queueEntrySchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', index: true },
    patientOpenemrId: { type: String, index: true },
    encounterOpenemrId: String,
    appointmentOpenemrId: String,
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', index: true },
    registrationKey: { type: String, select: false },
    paymentRequired: { type: Boolean, default: false },
    consultationFee: { type: Number, min: 0 },
    consultationInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    paymentClearedAt: Date,
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    doctorOpenemrId: { type: String, index: true },
    reason: { type: String, maxlength: 300 },
    tokenNumber: { type: Number, required: true, min: 1 },
    queueDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    state: {
      type: String,
      required: true,
      enum: Object.values(QUEUE_STATES),
      default: QUEUE_STATES.REGISTERED,
      index: true,
    },
    priority: { type: Number, default: 0, min: 0, max: 100 },
    checkInAt: Date,
    vitalsStartedAt: Date,
    vitalsCompletedAt: Date,
    consultationStartedAt: Date,
    consultationCompletedAt: Date,
    billingCompletedAt: Date,
    completedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    transitions: { type: [transitionSchema], default: [] },
  },
  documentSchemaOptions,
);

queueEntrySchema.index({ clinicId: 1, queueDate: 1, tokenNumber: 1 }, { unique: true });
queueEntrySchema.index({ clinicId: 1, queueDate: 1, doctorOpenemrId: 1, state: 1 });
queueEntrySchema.index(
  { clinicId: 1, appointmentId: 1 },
  {
    name: 'queue_appointment_unique',
    unique: true,
    partialFilterExpression: { appointmentId: { $type: 'objectId' } },
  },
);
queueEntrySchema.index(
  { clinicId: 1, registrationKey: 1 },
  {
    name: 'queue_registration_key_unique',
    unique: true,
    partialFilterExpression: { registrationKey: { $type: 'string' } },
  },
);

const baseQueueTransform = queueEntrySchema.get('toJSON').transform;
queueEntrySchema.set('toJSON', {
  ...queueEntrySchema.get('toJSON'),
  transform: (document, result) => {
    baseQueueTransform(document, result);
    delete result.registrationKey;
    return result;
  },
});

export const QueueEntry =
  mongoose.models.QueueEntry || mongoose.model('QueueEntry', queueEntrySchema);
