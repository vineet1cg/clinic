import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, index: true },
    action: { type: String, required: true, index: true, maxlength: 120 },
    resourceType: { type: String, required: true, maxlength: 80 },
    resourceId: { type: String, maxlength: 120 },
    ipAddress: { type: String, maxlength: 64 },
    userAgent: { type: String, maxlength: 300 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ clinicId: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
