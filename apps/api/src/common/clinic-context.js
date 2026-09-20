import { AppError } from './app-error.js';

export function getClinicId(user) {
  if (!user?.clinicId) {
    throw new AppError({
      code: 'CLINIC_CONTEXT_REQUIRED',
      message: 'This account is not assigned to a clinic.',
      statusCode: 403,
    });
  }
  return user.clinicId;
}
