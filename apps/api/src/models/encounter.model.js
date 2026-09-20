import mongoose from 'mongoose';
import { ENCOUNTER_STATUSES } from '@clinicos/contracts';
import { documentSchemaOptions } from '../db/schema-options.js';

const vitalsSchema = new mongoose.Schema(
  {
    temperatureC: Number,
    pulseBpm: Number,
    systolicBp: Number,
    diastolicBp: Number,
    respiratoryRate: Number,
    oxygenSaturation: Number,
    weightKg: Number,
    heightCm: Number,
    notes: String,
    recordedBy: mongoose.Schema.Types.ObjectId,
    recordedAt: Date,
  },
  { _id: false },
);

const prescriptionItemSchema = new mongoose.Schema(
  {
    medicine: { type: String, required: true },
    dose: { type: String, required: true },
    frequency: { type: String, required: true },
    duration: { type: String, required: true },
    instructions: String,
    quantity: Number,
  },
  { _id: true },
);

const encounterSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    queueEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QueueEntry',
      required: true,
      unique: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: Object.values(ENCOUNTER_STATUSES),
      default: ENCOUNTER_STATUSES.DRAFT,
    },
    chiefComplaint: String,
    historyPresentIllness: String,
    examination: String,
    assessment: String,
    plan: String,
    diagnoses: { type: [String], default: [] },
    prescriptions: { type: [prescriptionItemSchema], default: [] },
    vitals: vitalsSchema,
    followUpDate: String,
    completedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    updatedBy: mongoose.Schema.Types.ObjectId,
  },
  documentSchemaOptions,
);

export const Encounter = mongoose.models.Encounter || mongoose.model('Encounter', encounterSchema);
