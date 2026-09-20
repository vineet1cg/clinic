import { env } from '../../config/env.js';
import { writeAuditEntry } from '../audit/audit.service.js';
import { authenticateCredentials, changePasswordForUser, toSafeUser } from './auth.service.js';

const baseCookieOptions = {
  sameSite: 'lax',
  secure: env.COOKIE_SECURE,
  path: '/',
  maxAge: env.SESSION_TTL_MINUTES * 60_000,
};

function setSessionCookies(res, { sessionToken, csrfToken }) {
  res.cookie(env.COOKIE_NAME, sessionToken, {
    ...baseCookieOptions,
    httpOnly: true,
  });
  res.cookie('clinicos_csrf', csrfToken, {
    ...baseCookieOptions,
    httpOnly: false,
  });
}

export async function login(req, res) {
  const result = await authenticateCredentials({
    ...req.body,
    requestContext: {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  });

  setSessionCookies(res, result);

  res.status(200).json({ user: result.user });
}

export async function logout(req, res) {
  req.user.sessionVersion += 1;
  await req.user.save();
  await writeAuditEntry({
    clinicId: req.user.clinicId,
    actorId: req.user._id,
    action: 'auth.logout',
    resourceType: 'user',
    resourceId: req.user.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.clearCookie(env.COOKIE_NAME, { ...baseCookieOptions, httpOnly: true });
  res.clearCookie('clinicos_csrf', { ...baseCookieOptions, httpOnly: false });
  res.status(204).end();
}

export async function changePassword(req, res) {
  const result = await changePasswordForUser({
    userId: req.user._id,
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword,
    requestContext: {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  });
  setSessionCookies(res, result);
  res.status(200).json({ user: result.user });
}

export function me(req, res) {
  res.status(200).json({ user: toSafeUser(req.user) });
}
