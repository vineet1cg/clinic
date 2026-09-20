import mongoose from 'mongoose';
import { documentSchemaOptions } from '../db/schema-options.js';

const clinicSettingsSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    clinicName: { type: String, required: true, default: 'Your Clinic' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    currency: { type: String, default: 'INR' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    tokenPrefix: { type: String, default: 'A' },
    defaultConsultationFee: { type: Number, default: 0 },
    language: { type: String, default: 'en' },
    receiptFormat: { type: String, default: 'A5' },
    prescriptionFooter: { type: String, default: '' },
    invoiceFooter: { type: String, default: '' },
    updatedBy: mongoose.Schema.Types.ObjectId,
  },
  documentSchemaOptions,
);

export const ClinicSettings =
  mongoose.models.ClinicSettings || mongoose.model('ClinicSettings', clinicSettingsSchema);
