import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ROLE_PERMISSIONS, USER_STATUSES } from '@clinicos/contracts';
import { AppError } from '../../common/app-error.js';
import { env } from '../../config/env.js';
import { User } from '../../models/user.model.js';
import { writeAuditEntry } from '../audit/audit.service.js';

const dummyPasswordHash = '$2b$12$H0Fhr7zzSwOXMl0cQibJpOEBsZoCfQllVV0NGA1rrtwGw2f29/sJi';

export function resolvePermissions(user) {
  if (user.status === USER_STATUSES.PASSWORD_RESET_REQUIRED) return [];
  const permissions = new Set(
    user.roles
      .flatMap((role) => ROLE_PERMISSIONS[role] || [])
      .concat(user.additionalPermissions || []),
  );

  for (const denied of user.deniedPermissions || []) permissions.delete(denied);
  return [...permissions].sort();
}

export function createSession(user) {
  const csrfToken = randomBytes(32).toString('hex');
  const sessionToken = jwt.sign(
    { csrfToken, sessionVersion: user.sessionVersion },
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      subject: user.id,
      issuer: 'clinicos-api',
      audience: 'clinicos-web',
      expiresIn: env.JWT_EXPIRES_IN,
    },
  );
  return { sessionToken, csrfToken };
}

export function toSafeUser(user) {
  return {
    id: user.id,
    clinicId: user.clinicId?.toString() || null,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    consultationFee: user.consultationFee ?? null,
    roles: user.roles,
    permissions: resolvePermissions(user),
    status: user.status,
    passwordResetRequired: user.status === USER_STATUSES.PASSWORD_RESET_REQUIRED,
  };
}

export async function authenticateCredentials({ email, password, requestContext }) {
  const user = await User.findOne({ email }).select('+passwordHash +sessionVersion');
  const invalidCredentials = () =>
    new AppError({
      code: 'INVALID_CREDENTIALS',
      message: 'Email or password is incorrect.',
      statusCode: 401,
    });

  if (!user) {
    await bcrypt.compare(password, dummyPasswordHash);
    await writeAuditEntry({
      clinicId: env.DEFAULT_CLINIC_ID,
      action: 'auth.login_failed',
      resourceType: 'user',
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      metadata: { reason: 'unknown_account' },
    });
    throw invalidCredentials();
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    const mayTrackAttempts =
      [USER_STATUSES.ACTIVE, USER_STATUSES.PASSWORD_RESET_REQUIRED].includes(user.status) &&
      (!user.lockUntil || user.lockUntil <= new Date());
    if (mayTrackAttempts) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= env.LOGIN_MAX_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + env.LOCKOUT_MINUTES * 60_000);
        user.failedLoginAttempts = 0;
      }
      await user.save();
    }
    await writeAuditEntry({
      clinicId: user.clinicId,
      actorId: user._id,
      action: 'auth.login_failed',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      metadata: { reason: 'password_mismatch' },
    });
    throw invalidCredentials();
  }

  if (
    user.status !== USER_STATUSES.ACTIVE &&
    user.status !== USER_STATUSES.PASSWORD_RESET_REQUIRED
  ) {
    await writeAuditEntry({
      clinicId: user.clinicId,
      actorId: user._id,
      action: 'auth.login_blocked',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      metadata: { reason: 'account_disabled' },
    });
    throw new AppError({
      code: 'ACCOUNT_DISABLED',
      message: 'This account is not active. Contact the clinic administrator.',
      statusCode: 403,
    });
  }

  if (user.lockUntil && user.lockUntil > new Date()) {
    await writeAuditEntry({
      clinicId: user.clinicId,
      actorId: user._id,
      action: 'auth.login_blocked',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      metadata: { reason: 'account_locked' },
    });
    throw new AppError({
      code: 'ACCOUNT_TEMPORARILY_LOCKED',
      message: 'Too many sign-in attempts. Try again later or contact the administrator.',
      statusCode: 423,
    });
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();

  const { sessionToken, csrfToken } = createSession(user);

  await writeAuditEntry({
    clinicId: user.clinicId,
    actorId: user._id,
    action: 'auth.login',
    resourceType: 'user',
    resourceId: user.id,
    ipAddress: requestContext.ipAddress,
    userAgent: requestContext.userAgent,
  });

  return { user: toSafeUser(user), sessionToken, csrfToken };
}

export async function changePasswordForUser({
  userId,
  currentPassword,
  newPassword,
  requestContext,
}) {
  const user = await User.findById(userId).select('+passwordHash +sessionVersion');
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    if (user) {
      await writeAuditEntry({
        clinicId: user.clinicId,
        actorId: user._id,
        action: 'auth.password_change_failed',
        resourceType: 'user',
        resourceId: user.id,
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
        metadata: { reason: 'current_password_mismatch' },
      });
    }
    throw new AppError({
      code: 'CURRENT_PASSWORD_INCORRECT',
      message: 'Your current password is incorrect.',
      statusCode: 401,
    });
  }

  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw new AppError({
      code: 'PASSWORD_REUSE_NOT_ALLOWED',
      message: 'Choose a password different from your current password.',
      statusCode: 422,
    });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordChangedAt = new Date();
  user.status = USER_STATUSES.ACTIVE;
  user.sessionVersion += 1;
  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  await user.save();

  await writeAuditEntry({
    clinicId: user.clinicId,
    actorId: user._id,
    action: 'auth.password_changed',
    resourceType: 'user',
    resourceId: user.id,
    ipAddress: requestContext.ipAddress,
    userAgent: requestContext.userAgent,
  });

  return { user: toSafeUser(user), ...createSession(user) };
}
