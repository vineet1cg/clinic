import mongoose from 'mongoose';
import { USER_ROLES, USER_STATUSES } from '@clinicos/contracts';

const userSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    openemrUserId: { type: String, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    consultationFee: { type: Number, min: 0, max: 10_000_000, default: null },
    passwordHash: { type: String, required: true, select: false },
    roles: {
      type: [{ type: String, enum: Object.values(USER_ROLES) }],
      required: true,
      default: [USER_ROLES.RECEPTIONIST],
    },
    additionalPermissions: { type: [String], default: [] },
    deniedPermissions: { type: [String], default: [] },
    status: {
      type: String,
      enum: Object.values(USER_STATUSES),
      default: USER_STATUSES.ACTIVE,
      index: true,
    },
    failedLoginAttempts: { type: Number, default: 0, min: 0 },
    lockUntil: Date,
    lastLoginAt: Date,
    passwordChangedAt: Date,
    sessionVersion: { type: Number, default: 0, min: 0, select: false },
  },
  { timestamps: true, optimisticConcurrency: true },
);

userSchema.index({ clinicId: 1, email: 1 });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
