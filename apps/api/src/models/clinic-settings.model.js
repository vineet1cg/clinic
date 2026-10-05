import mongoose from 'mongoose';
import { CLINIC_LANGUAGES, RECEIPT_FORMATS, isValidTimeZone } from '@clinicos/contracts';
import { documentSchemaOptions } from '../db/schema-options.js';

const normalizedPhonePattern = /^\+?[1-9]\d{7,14}$/;

function hasAtMostTwoDecimalPlaces(value) {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;
}

const clinicSettingsSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    clinicName: {
      type: String,
      required: true,
      default: 'Your Clinic',
      trim: true,
      minlength: 2,
      maxlength: 160,
    },
    address: { type: String, default: '', trim: true, maxlength: 500 },
    phone: {
      type: String,
      default: '',
      trim: true,
      validate: {
        validator: (value) => value === '' || normalizedPhonePattern.test(value),
        message: 'Enter a valid mobile number including country code when needed.',
      },
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
      trim: true,
      minlength: 3,
      maxlength: 80,
      validate: { validator: isValidTimeZone, message: 'Enter a valid IANA timezone.' },
    },
    tokenPrefix: {
      type: String,
      default: 'A',
      trim: true,
      uppercase: true,
      minlength: 1,
      maxlength: 8,
    },
    defaultConsultationFee: {
      type: Number,
      default: 0,
      min: 0,
      max: 10_000_000,
      validate: {
        validator: hasAtMostTwoDecimalPlaces,
        message: 'Use no more than two decimal places.',
      },
    },
    language: { type: String, enum: CLINIC_LANGUAGES, default: 'en' },
    receiptFormat: { type: String, enum: RECEIPT_FORMATS, default: 'A5' },
    prescriptionFooter: { type: String, default: '', trim: true, maxlength: 500 },
    invoiceFooter: { type: String, default: '', trim: true, maxlength: 500 },
    updatedBy: mongoose.Schema.Types.ObjectId,
  },
  documentSchemaOptions,
);

export const ClinicSettings =
  mongoose.models.ClinicSettings || mongoose.model('ClinicSettings', clinicSettingsSchema);
