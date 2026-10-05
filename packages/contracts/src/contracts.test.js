import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS,
  QUEUE_TRANSITIONS,
  ROLE_PERMISSIONS,
  USER_ROLES,
  appointmentCreateSchema,
  auditLogQuerySchema,
  changePasswordSchema,
  invoiceCreateSchema,
  invoiceListSchema,
  patientCreateSchema,
  paymentCreateSchema,
} from './index.js';

describe('shared ClinicOS contracts', () => {
  it('accepts a valid minimal patient', () => {
    const result = patientCreateSchema.safeParse({
      fullName: 'Aarav Shah',
      mobile: '+919876543210',
      gender: 'MALE',
      age: 42,
    });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid patient', () => {
    const result = patientCreateSchema.safeParse({ fullName: '', mobile: '12' });
    expect(result.success).toBe(false);
  });

  it('validates appointment input', () => {
    const result = appointmentCreateSchema.safeParse({
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      date: '2026-09-14',
      time: '10:30',
      reason: 'Follow-up consultation',
      visitType: 'FOLLOW_UP',
    });

    expect(result.success).toBe(true);
  });

  it('keeps receptionist permissions away from clinical editing', () => {
    expect(ROLE_PERMISSIONS[USER_ROLES.RECEPTIONIST]).not.toContain(PERMISSIONS.ENCOUNTER_UPDATE);
    expect(ROLE_PERMISSIONS[USER_ROLES.RECEPTIONIST]).toContain(PERMISSIONS.BILLING_CREATE);
    expect(ROLE_PERMISSIONS[USER_ROLES.RECEPTIONIST]).toContain(PERMISSIONS.PAYMENT_COLLECT);
  });

  it('keeps doctors focused on clinical work instead of reception and billing actions', () => {
    expect(ROLE_PERMISSIONS[USER_ROLES.DOCTOR]).toContain(PERMISSIONS.ENCOUNTER_COMPLETE);
    expect(ROLE_PERMISSIONS[USER_ROLES.DOCTOR]).toContain(PERMISSIONS.VITALS_CREATE);
    expect(ROLE_PERMISSIONS[USER_ROLES.DOCTOR]).toContain(PERMISSIONS.VITALS_UPDATE);
    expect(ROLE_PERMISSIONS[USER_ROLES.DOCTOR]).not.toContain(PERMISSIONS.QUEUE_MANAGE);
    expect(ROLE_PERMISSIONS[USER_ROLES.DOCTOR]).not.toContain(PERMISSIONS.BILLING_CREATE);
    expect(ROLE_PERMISSIONS[USER_ROLES.DOCTOR]).not.toContain(PERMISSIONS.PAYMENT_COLLECT);
  });

  it('defines the normal queue progression', () => {
    expect(QUEUE_TRANSITIONS.PAYMENT_PENDING).not.toContain('WAITING');
    expect(QUEUE_TRANSITIONS.WAITING).toContain('VITALS_PENDING');
    expect(QUEUE_TRANSITIONS.PAID).toContain('COMPLETED');
  });

  it('rejects fractional-paisa payments', () => {
    expect(paymentCreateSchema.safeParse({ amount: 1.005, method: 'CASH' }).success).toBe(false);
    expect(paymentCreateSchema.safeParse({ amount: 1.01, method: 'CASH' }).success).toBe(true);
  });

  it('supports recovering the final invoice for a reception handoff', () => {
    expect(
      invoiceListSchema.safeParse({ queueEntryId: 'queue-1', purpose: 'GENERAL' }).success,
    ).toBe(true);
  });

  it('removes blank optional visit relationships from a general invoice', () => {
    const invoice = invoiceCreateSchema.parse({
      patientId: 'patient-1',
      queueEntryId: '',
      doctorId: '   ',
      items: [{ description: 'Procedure', quantity: 1, rate: 2000 }],
      discount: 0,
    });

    expect(invoice.queueEntryId).toBeUndefined();
    expect(invoice.doctorId).toBeUndefined();
  });

  it('requires a strong confirmed replacement password', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'ChangeMe123!',
        newPassword: 'A-Different-Strong9!',
        confirmPassword: 'A-Different-Strong9!',
      }).success,
    ).toBe(true);
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'ChangeMe123!',
        newPassword: 'weak-password',
        confirmPassword: 'weak-password',
      }).success,
    ).toBe(false);
  });

  it('bounds audit log pagination', () => {
    expect(auditLogQuerySchema.safeParse({ limit: 100 }).success).toBe(true);
    expect(auditLogQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});
