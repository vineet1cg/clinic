import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { USER_ROLES, USER_STATUSES } from '@clinicos/contracts';
import { env } from '../config/env.js';
import { connectMongo, disconnectMongo } from '../db/mongoose.js';
import { User } from '../models/user.model.js';

const password = process.env.E2E_TEST_PASSWORD || '';
if (password.length < 12) {
  throw new Error('E2E_TEST_PASSWORD of at least 12 characters is required.');
}

const accounts = [
  {
    name: 'E2E Receptionist',
    email: 'e2e.reception@clinic.local',
    roles: [USER_ROLES.RECEPTIONIST],
  },
  {
    name: 'E2E Nurse',
    email: 'e2e.nurse@clinic.local',
    roles: [USER_ROLES.NURSE],
  },
  {
    name: 'E2E Doctor',
    email: 'e2e.doctor@clinic.local',
    roles: [USER_ROLES.DOCTOR],
    consultationFee: 500,
  },
  {
    name: 'E2E Billing Staff',
    email: 'e2e.billing@clinic.local',
    roles: [USER_ROLES.BILLING_STAFF],
  },
];

await connectMongo();

try {
  const passwordHash = await bcrypt.hash(password, 12);
  for (const account of accounts) {
    const existing = await User.findOne({ email: account.email }).select(
      '+passwordHash +sessionVersion',
    );
    const user = existing || new User({ email: account.email });

    Object.assign(user, account, {
      clinicId: env.DEFAULT_CLINIC_ID,
      passwordHash,
      status: USER_STATUSES.ACTIVE,
      additionalPermissions: [],
      deniedPermissions: [],
      failedLoginAttempts: 0,
      lockUntil: undefined,
      passwordChangedAt: new Date(),
      sessionVersion: existing ? (existing.sessionVersion || 0) + 1 : 0,
    });
    if (!Object.hasOwn(account, 'consultationFee')) user.consultationFee = null;
    await user.save();
  }

  console.log(`Created or refreshed ${accounts.length} local E2E staff accounts:`);
  for (const account of accounts) console.log(`- ${account.email} (${account.roles.join(', ')})`);
} finally {
  await disconnectMongo();
}
