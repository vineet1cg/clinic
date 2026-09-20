import mongoose from 'mongoose';
import { LAB_STATUSES } from '@clinicos/contracts';
import { documentSchemaOptions } from '../db/schema-options.js';

const labOrderSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    orderNumber: { type: String, required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    encounterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Encounter' },
    testName: { type: String, required: true },
    priority: { type: String, enum: ['ROUTINE', 'URGENT'], default: 'ROUTINE' },
    status: {
      type: String,
      enum: Object.values(LAB_STATUSES),
      default: LAB_STATUSES.ORDERED,
      index: true,
    },
    notes: String,
    result: String,
    orderedBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    verifiedBy: mongoose.Schema.Types.ObjectId,
    verifiedAt: Date,
  },
  documentSchemaOptions,
);

labOrderSchema.index({ clinicId: 1, orderNumber: 1 }, { unique: true });

const baseLabOrderTransform = labOrderSchema.get('toJSON').transform;
labOrderSchema.set('toJSON', {
  ...labOrderSchema.get('toJSON'),
  transform: (document, result) => {
    baseLabOrderTransform(document, result);
    delete result.orderedBy;
    delete result.verifiedBy;
    return result;
  },
});

export const LabOrder = mongoose.models.LabOrder || mongoose.model('LabOrder', labOrderSchema);
