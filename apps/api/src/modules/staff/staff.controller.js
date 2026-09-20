import bcrypt from 'bcryptjs';
import { PERMISSIONS, ROLE_PERMISSIONS, USER_ROLES, USER_STATUSES } from '@clinicos/contracts';
import { AppError } from '../../common/app-error.js';
import { getClinicId } from '../../common/clinic-context.js';
import { User } from '../../models/user.model.js';
import { writeAuditEntry } from '../audit/audit.service.js';
import { resolvePermissions, toSafeUser } from '../auth/auth.service.js';

const privilegedRoles = new Set([USER_ROLES.SUPER_ADMIN, USER_ROLES.CLINIC_OWNER]);

function isSuperAdmin(user) {
  return user.roles.includes(USER_ROLES.SUPER_ADMIN);
}

function assertRoleAssignmentAllowed(actor, roles) {
  if (roles?.some((role) => privilegedRoles.has(role)) && !isSuperAdmin(actor)) {
    throw new AppError({
      code: 'PRIVILEGED_ROLE_FORBIDDEN',
      message: 'Only a super administrator can assign administrator roles.',
      statusCode: 403,
    });
  }
}

export async function listStaff(req, res) {
  const filter = { clinicId: getClinicId(req.user) };
  if (req.validated.query.role) filter.roles = req.validated.query.role;
  const staff = await User.find(filter).sort({ name: 1 });
  res.json({ staff: staff.map(toSafeUser) });
}

export function listRoles(_req, res) {
  res.json({
    roles: Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({ role, permissions })),
  });
}

export async function createStaff(req, res) {
  const clinicId = getClinicId(req.user);
  assertRoleAssignmentAllowed(req.user, req.body.roles);
  if (
    req.body.consultationFee !== undefined &&
    !req.body.roles.some((role) => [USER_ROLES.DOCTOR, USER_ROLES.SUPER_ADMIN].includes(role))
  ) {
    throw new AppError({
      code: 'CONSULTATION_FEE_REQUIRES_DOCTOR',
      message: 'A consultation fee override can only be assigned to a doctor.',
      statusCode: 422,
    });
  }
  const exists = await User.exists({ email: req.body.email });
  if (exists) {
    throw new AppError({
      code: 'STAFF_EMAIL_EXISTS',
      message: 'A staff account already uses this email.',
      statusCode: 409,
    });
  }
  const user = await User.create({
    clinicId,
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    consultationFee: req.body.consultationFee,
    passwordHash: await bcrypt.hash(req.body.password, 12),
    roles: req.body.roles,
    status: USER_STATUSES.PASSWORD_RESET_REQUIRED,
  });
  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'staff.create',
    resourceType: 'user',
    resourceId: user.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { roles: user.roles },
  });
  res.status(201).json({ staffMember: toSafeUser(user) });
}

export async function updateStaff(req, res) {
  const clinicId = getClinicId(req.user);
  const user = await User.findOne({ _id: req.params.id, clinicId });
  if (!user)
    throw new AppError({
      code: 'STAFF_NOT_FOUND',
      message: 'Staff member was not found.',
      statusCode: 404,
    });
  if (user.roles.some((role) => privilegedRoles.has(role)) && !isSuperAdmin(req.user)) {
    throw new AppError({
      code: 'PRIVILEGED_ACCOUNT_FORBIDDEN',
      message: 'Only a super administrator can modify this account.',
      statusCode: 403,
    });
  }
  assertRoleAssignmentAllowed(req.user, req.body.roles);
  if (
    req.body.consultationFee !== undefined &&
    !(req.body.roles || user.roles).some((role) =>
      [USER_ROLES.DOCTOR, USER_ROLES.SUPER_ADMIN].includes(role),
    )
  ) {
    throw new AppError({
      code: 'CONSULTATION_FEE_REQUIRES_DOCTOR',
      message: 'A consultation fee override can only be assigned to a doctor.',
      statusCode: 422,
    });
  }
  if (
    req.params.id === req.user.id &&
    req.body.status &&
    req.body.status !== USER_STATUSES.ACTIVE
  ) {
    throw new AppError({
      code: 'CANNOT_DEACTIVATE_SELF',
      message: 'You cannot deactivate your own account.',
      statusCode: 409,
    });
  }
  if (
    req.body.status &&
    req.body.status !== USER_STATUSES.ACTIVE &&
    !resolvePermissions(req.user).includes(PERMISSIONS.STAFF_DEACTIVATE)
  ) {
    throw new AppError({
      code: 'STAFF_DEACTIVATE_FORBIDDEN',
      message: 'You do not have permission to deactivate staff accounts.',
      statusCode: 403,
    });
  }

  const removesSuperAdmin =
    user.roles.includes(USER_ROLES.SUPER_ADMIN) &&
    ((req.body.roles && !req.body.roles.includes(USER_ROLES.SUPER_ADMIN)) ||
      (req.body.status && req.body.status !== USER_STATUSES.ACTIVE));
  if (removesSuperAdmin) {
    const otherActiveSuperAdmins = await User.countDocuments({
      _id: { $ne: user._id },
      clinicId,
      roles: USER_ROLES.SUPER_ADMIN,
      status: USER_STATUSES.ACTIVE,
    });
    if (otherActiveSuperAdmins === 0) {
      throw new AppError({
        code: 'LAST_SUPER_ADMIN_REQUIRED',
        message: 'The clinic must keep at least one active super administrator.',
        statusCode: 409,
      });
    }
  }

  Object.assign(user, req.body);
  if (
    req.body.roles &&
    !user.roles.some((role) => [USER_ROLES.DOCTOR, USER_ROLES.SUPER_ADMIN].includes(role))
  ) {
    user.consultationFee = null;
  }
  await user.save();
  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'staff.update',
    resourceType: 'user',
    resourceId: user.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { fields: Object.keys(req.body) },
  });
  res.json({ staffMember: toSafeUser(user) });
}
