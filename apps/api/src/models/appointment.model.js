import mongoose from 'mongoose';
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from '@clinicos/contracts';
import { documentSchemaOptions } from '../db/schema-options.js';

const appointmentSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    appointmentNumber: { type: String, required: true },
    openemrAppointmentId: String,
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
    time: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    reason: { type: String, required: true, maxlength: 300 },
    visitType: { type: String, enum: APPOINTMENT_TYPES, required: true },
    notes: String,
    referralSource: String,
    reminderPreference: { type: String, enum: ['NONE', 'SMS', 'WHATSAPP'], default: 'NONE' },
    status: {
      type: String,
      enum: Object.values(APPOINTMENT_STATUSES),
      default: APPOINTMENT_STATUSES.SCHEDULED,
      index: true,
    },
    cancellationReason: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    updatedBy: mongoose.Schema.Types.ObjectId,
  },
  documentSchemaOptions,
);

appointmentSchema.index({ clinicId: 1, appointmentNumber: 1 }, { unique: true });
appointmentSchema.index({ clinicId: 1, doctorId: 1, date: 1, time: 1 });

export const Appointment =
  mongoose.models.Appointment || mongoose.model('Appointment', appointmentSchema);
