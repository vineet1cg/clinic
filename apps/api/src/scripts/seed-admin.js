import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { USER_ROLES, USER_STATUSES } from '@clinicos/contracts';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { connectMongo, disconnectMongo } from '../db/mongoose.js';
import { User } from '../models/user.model.js';

const name = process.env.SEED_ADMIN_NAME || 'Clinic Administrator';
const email = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD || '';

if (!email || password.length < 12) {
  throw new Error(
    'SEED_ADMIN_EMAIL and a SEED_ADMIN_PASSWORD of at least 12 characters are required',
  );
}

await connectMongo();

try {
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await User.findOne({ email }).select('+sessionVersion');

  if (existing) {
    existing.clinicId = env.DEFAULT_CLINIC_ID;
    existing.name = name;
    existing.passwordHash = passwordHash;
    existing.roles = [USER_ROLES.SUPER_ADMIN];
    existing.status = USER_STATUSES.PASSWORD_RESET_REQUIRED;
    existing.sessionVersion = (existing.sessionVersion || 0) + 1;
    existing.failedLoginAttempts = 0;
    existing.lockUntil = undefined;
    await existing.save();
    logger.info({ email }, 'Development administrator reset');
  } else {
    await User.create({
      clinicId: env.DEFAULT_CLINIC_ID,
      name,
      email,
      passwordHash,
      roles: [USER_ROLES.SUPER_ADMIN],
      status: USER_STATUSES.PASSWORD_RESET_REQUIRED,
    });
    logger.info({ email }, 'Development administrator created');
  }
} finally {
  await disconnectMongo();
}
