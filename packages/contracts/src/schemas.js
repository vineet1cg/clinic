import { z } from 'zod';
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  INVOICE_STATUSES,
  INVENTORY_TRANSACTION_TYPES,
  LAB_STATUSES,
  PAYMENT_METHODS,
  QUEUE_STATES,
  USER_ROLES,
  USER_STATUSES,
} from './constants.js';

const normalizedPhone = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{7,14}$/, 'Enter a valid mobile number including country code when needed');

function isValidTimeZone(value) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const strongPasswordSchema = z
  .string()
  .min(12, 'Password must contain at least 12 characters')
  .max(128, 'Password must contain at most 128 characters')
  .regex(/[a-z]/, 'Include at least one lowercase letter')
  .regex(/[A-Z]/, 'Include at least one uppercase letter')
  .regex(/\d/, 'Include at least one number')
  .regex(/[^A-Za-z0-9\s]/, 'Include at least one symbol');

export const loginSchema = z.object({
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  password: z.string().min(8, 'Password must contain at least 8 characters').max(128),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(128),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password').max(128),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'Choose a password different from your current password',
    path: ['newPassword'],
  });

const patientFieldsSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  mobile: normalizedPhone,
  gender: z.enum(['FEMALE', 'MALE', 'OTHER', 'UNKNOWN']),
  dateOfBirth: z.iso.date().optional(),
  age: z.coerce.number().int().min(0).max(130).optional(),
  email: z.union([z.email(), z.literal('')]).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  pinCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/)
    .optional(),
  emergencyContact: normalizedPhone.optional(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN']).optional(),
  preferredLanguage: z.enum(['en', 'gu', 'hi']).default('en'),
  governmentId: z.string().trim().max(80).optional(),
  abhaId: z.string().trim().max(80).optional(),
});

export const patientCreateSchema = patientFieldsSchema
  .extend({
    allowDuplicate: z.boolean().default(false),
    duplicateReason: z.string().trim().max(300).optional(),
  })
  .refine((patient) => patient.dateOfBirth !== undefined || patient.age !== undefined, {
    message: 'Provide date of birth or age',
    path: ['dateOfBirth'],
  })
  .refine((patient) => !patient.allowDuplicate || Boolean(patient.duplicateReason), {
    message: 'Explain why this is a different patient',
    path: ['duplicateReason'],
  });

export const patientUpdateSchema = patientFieldsSchema
  .partial()
  .refine((patient) => Object.keys(patient).length > 0, {
    message: 'Provide at least one field to update',
  });

export const patientSearchSchema = z.object({
  query: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const appointmentCreateSchema = z.object({
  patientId: z.string().trim().min(1),
  doctorId: z.string().trim().min(1),
  date: z.iso.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  reason: z.string().trim().min(2).max(300),
  visitType: z.enum(APPOINTMENT_TYPES),
  notes: z.string().trim().max(1000).optional(),
  referralSource: z.string().trim().max(120).optional(),
  reminderPreference: z.enum(['NONE', 'SMS', 'WHATSAPP']).default('NONE'),
});

export const appointmentListSchema = z
  .object({
    date: z.iso.date().optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    doctorId: z.string().trim().optional(),
    status: z.enum(Object.values(APPOINTMENT_STATUSES)).optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'The start date must be on or before the end date',
    path: ['to'],
  });

export const appointmentCancelSchema = z.object({
  reason: z.string().trim().min(2).max(300),
});

export const walkInCreateSchema = z.object({
  patientId: z.string().trim().min(1),
  doctorId: z.string().trim().min(1),
  reason: z.string().trim().min(2).max(300),
  priority: z.coerce.number().int().min(0).max(100).default(0),
});

export const queueListSchema = z.object({
  date: z.iso.date().optional(),
  doctorId: z.string().trim().optional(),
  state: z.enum(Object.values(QUEUE_STATES)).optional(),
});

export const queueTransitionSchema = z.object({
  state: z.enum(Object.values(QUEUE_STATES)),
  reason: z.string().trim().max(300).optional(),
});

export const userRoleSchema = z.enum(Object.values(USER_ROLES));

export const vitalsSchema = z.object({
  temperatureC: z.coerce.number().min(30).max(45).optional(),
  pulseBpm: z.coerce.number().int().min(20).max(250).optional(),
  systolicBp: z.coerce.number().int().min(50).max(300).optional(),
  diastolicBp: z.coerce.number().int().min(30).max(200).optional(),
  respiratoryRate: z.coerce.number().int().min(5).max(80).optional(),
  oxygenSaturation: z.coerce.number().min(50).max(100).optional(),
  weightKg: z.coerce.number().min(0.5).max(500).optional(),
  heightCm: z.coerce.number().min(20).max(280).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const prescriptionItemSchema = z.object({
  medicine: z.string().trim().min(2).max(160),
  dose: z.string().trim().min(1).max(80),
  frequency: z.string().trim().min(1).max(80),
  duration: z.string().trim().min(1).max(80),
  instructions: z.string().trim().max(300).optional(),
  quantity: z.coerce.number().int().min(1).max(1000).optional(),
});

export const encounterCreateSchema = z.object({
  queueEntryId: z.string().trim().min(1),
});

export const encounterUpdateSchema = z.object({
  chiefComplaint: z.string().trim().max(1000).optional(),
  historyPresentIllness: z.string().trim().max(4000).optional(),
  examination: z.string().trim().max(4000).optional(),
  assessment: z.string().trim().max(4000).optional(),
  plan: z.string().trim().max(4000).optional(),
  diagnoses: z.array(z.string().trim().min(2).max(240)).max(20).optional(),
  prescriptions: z.array(prescriptionItemSchema).max(30).optional(),
  followUpDate: z.union([z.iso.date(), z.literal('')]).optional(),
});

const invoiceItemSchema = z.object({
  description: z.string().trim().min(2).max(160),
  quantity: z.coerce.number().min(0.01).max(1000),
  rate: z.coerce.number().min(0).max(10_000_000),
});

export const invoiceCreateSchema = z.object({
  patientId: z.string().trim().min(1),
  queueEntryId: z.string().trim().optional(),
  doctorId: z.string().trim().optional(),
  items: z.array(invoiceItemSchema).min(1).max(100),
  discount: z.coerce.number().min(0).max(10_000_000).default(0),
  notes: z.string().trim().max(500).optional(),
});

export const invoiceListSchema = z.object({
  status: z.enum(Object.values(INVOICE_STATUSES)).optional(),
  patientId: z.string().trim().optional(),
  date: z.iso.date().optional(),
});

export const paymentCreateSchema = z.object({
  amount: z.coerce
    .number()
    .positive()
    .max(10_000_000)
    .refine(
      (value) =>
        Number.isInteger(Math.round(value * 100)) &&
        Math.abs(value * 100 - Math.round(value * 100)) < 1e-7,
      'Use no more than two decimal places',
    ),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(120).optional(),
});

export const staffCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase(),
  phone: normalizedPhone.optional(),
  password: strongPasswordSchema,
  roles: z.array(z.enum(Object.values(USER_ROLES))).min(1),
  consultationFee: z.number().positive().max(10_000_000).multipleOf(0.01).optional(),
});

export const staffListSchema = z.object({
  role: z.enum(Object.values(USER_ROLES)).optional(),
});

export const staffUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: normalizedPhone.optional(),
  roles: z
    .array(z.enum(Object.values(USER_ROLES)))
    .min(1)
    .optional(),
  status: z.enum(Object.values(USER_STATUSES)).optional(),
  consultationFee: z.number().positive().max(10_000_000).multipleOf(0.01).nullable().optional(),
});

export const clinicSettingsSchema = z.object({
  clinicName: z.string().trim().min(2).max(160),
  address: z.string().trim().max(500).default(''),
  phone: z.union([normalizedPhone, z.literal('')]).default(''),
  currency: z.string().trim().length(3).toUpperCase().default('INR'),
  timezone: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .refine(isValidTimeZone, 'Enter a valid IANA timezone')
    .default('Asia/Kolkata'),
  tokenPrefix: z.string().trim().min(1).max(8).toUpperCase().default('A'),
  defaultConsultationFee: z.coerce.number().min(0).max(10_000_000).multipleOf(0.01).default(0),
  language: z.enum(['en', 'gu', 'hi']).default('en'),
  receiptFormat: z.enum(['A4', 'A5', 'THERMAL_80MM']).default('A5'),
  prescriptionFooter: z.string().trim().max(500).default(''),
  invoiceFooter: z.string().trim().max(500).default(''),
});

export const inventoryItemCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  genericName: z.string().trim().max(160).optional(),
  sku: z.string().trim().min(1).max(80).toUpperCase(),
  batchNumber: z.string().trim().max(80).optional(),
  expiryDate: z.union([z.iso.date(), z.literal('')]).optional(),
  reorderLevel: z.coerce.number().int().min(0).max(1_000_000).default(0),
  unit: z.string().trim().min(1).max(40).default('unit'),
});

export const inventoryTransactionSchema = z.object({
  type: z.enum(INVENTORY_TRANSACTION_TYPES),
  quantity: z.coerce.number().int().positive().max(1_000_000),
  reason: z.string().trim().min(2).max(300),
});

export const labOrderCreateSchema = z.object({
  patientId: z.string().trim().min(1),
  encounterId: z.string().trim().optional(),
  testName: z.string().trim().min(2).max(160),
  priority: z.enum(['ROUTINE', 'URGENT']).default('ROUTINE'),
  notes: z.string().trim().max(500).optional(),
});

export const labOrderUpdateSchema = z.object({
  status: z.enum(Object.values(LAB_STATUSES)),
  result: z.string().trim().max(5000).optional(),
});

export const labOrderListSchema = z.object({
  status: z.enum(Object.values(LAB_STATUSES)).optional(),
});

export const reportQuerySchema = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'The start date must be on or before the end date',
    path: ['to'],
  });

export const auditLogQuerySchema = z
  .object({
    cursor: z
      .string()
      .regex(/^[a-f\d]{24}$/i, 'Cursor must be a valid record identifier')
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    action: z.string().trim().min(1).max(120).optional(),
    resourceType: z.string().trim().min(1).max(80).optional(),
    actorId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, 'Actor must be a valid record identifier')
      .optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'The start time must be on or before the end time',
    path: ['to'],
  });
