import mongoose from 'mongoose';
import { documentSchemaOptions } from '../db/schema-options.js';

const patientSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    patientNumber: { type: String, required: true },
    openemrPatientId: { type: String, trim: true },
    source: { type: String, enum: ['OPENEMR', 'CLINICOS_LOCAL'], required: true },
    fullName: { type: String, required: true, trim: true, maxlength: 120, index: true },
    normalizedName: { type: String, required: true, index: true, select: false },
    mobile: { type: String, required: true, trim: true, index: true },
    normalizedMobile: { type: String, required: true, index: true, select: false },
    gender: { type: String, enum: ['FEMALE', 'MALE', 'OTHER', 'UNKNOWN'], required: true },
    dateOfBirth: String,
    age: Number,
    email: { type: String, lowercase: true, trim: true },
    address: String,
    city: String,
    state: String,
    pinCode: String,
    emergencyContact: String,
    bloodGroup: String,
    preferredLanguage: { type: String, default: 'en' },
    governmentId: { type: String, select: false },
    abhaId: { type: String, select: false },
    duplicateReason: { type: String, select: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    updatedBy: mongoose.Schema.Types.ObjectId,
  },
  documentSchemaOptions,
);

const basePatientTransform = patientSchema.get('toJSON').transform;
patientSchema.set('toJSON', {
  ...patientSchema.get('toJSON'),
  transform: (document, result) => {
    basePatientTransform(document, result);
    delete result.normalizedName;
    delete result.normalizedMobile;
    delete result.openemrPatientId;
    delete result.governmentId;
    delete result.abhaId;
    delete result.duplicateReason;
    return result;
  },
});

patientSchema.index({ clinicId: 1, patientNumber: 1 }, { unique: true });
patientSchema.index(
  { clinicId: 1, openemrPatientId: 1 },
  {
    name: 'patient_openemr_id_unique',
    unique: true,
    partialFilterExpression: { openemrPatientId: { $type: 'string' } },
  },
);
patientSchema.index({ clinicId: 1, normalizedMobile: 1 });
patientSchema.index({ clinicId: 1, normalizedName: 1, dateOfBirth: 1 });

export const Patient = mongoose.models.Patient || mongoose.model('Patient', patientSchema);
