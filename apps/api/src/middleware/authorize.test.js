import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, USER_ROLES, USER_STATUSES } from '@clinicos/contracts';
import { authorize, requirePasswordChangeComplete } from './authorize.js';

function resetRequiredUser() {
  return {
    roles: [USER_ROLES.SUPER_ADMIN],
    additionalPermissions: [],
    deniedPermissions: [],
    status: USER_STATUSES.PASSWORD_RESET_REQUIRED,
  };
}

describe('password reset authorization boundary', () => {
  it('denies resource permissions until the temporary password is changed', () => {
    const next = vi.fn();
    authorize(PERMISSIONS.PATIENT_VIEW)({ user: resetRequiredUser() }, {}, next);
    expect(next.mock.calls[0][0]).toMatchObject({
      code: 'PASSWORD_CHANGE_REQUIRED',
      statusCode: 403,
    });
  });

  it('denies authenticated dashboard access until password change is complete', () => {
    const next = vi.fn();
    requirePasswordChangeComplete({ user: resetRequiredUser() }, {}, next);
    expect(next.mock.calls[0][0]).toMatchObject({
      code: 'PASSWORD_CHANGE_REQUIRED',
      statusCode: 403,
    });
  });
});
