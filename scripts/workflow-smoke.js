import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { Appointment } from '../apps/api/src/models/appointment.model.js';
import { dateInTimeZone } from '../apps/api/src/common/clinic-time.js';
import { Encounter } from '../apps/api/src/models/encounter.model.js';
import { ClinicSettings } from '../apps/api/src/models/clinic-settings.model.js';
import { InventoryItem } from '../apps/api/src/models/inventory-item.model.js';
import { Invoice } from '../apps/api/src/models/invoice.model.js';
import { LabOrder } from '../apps/api/src/models/lab-order.model.js';
import { Patient } from '../apps/api/src/models/patient.model.js';
import { QueueEntry } from '../apps/api/src/models/queue-entry.model.js';
import { User } from '../apps/api/src/models/user.model.js';

config({ path: new URL('../apps/api/.env', import.meta.url), quiet: true });

const apiBaseUrl = process.env.SMOKE_API_URL || 'http://127.0.0.1:4000/api/v1';
const suffix = String(Date.now());
const email = `smoke-${suffix}@clinic.local`;
const password = `ClinicOS-Smoke-${randomBytes(12).toString('hex')}9!`;
const created = {};
let cookies = '';
let csrfToken = '';

function captureSessionCookies(response) {
  const setCookies = response.headers.getSetCookie();
  if (!setCookies.length) return;
  cookies = setCookies.map((value) => value.split(';')[0]).join('; ');
  csrfToken = decodeURIComponent(
    setCookies
      .find((value) => value.startsWith('clinicos_csrf='))
      ?.split(';')[0]
      .split('=')[1] || '',
  );
}

async function request(path, { method = 'GET', body, headers = {}, expectStatus } = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookies ? { cookie: cookies } : {}),
      ...(method !== 'GET' && csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  captureSessionCookies(response);
  const payload = response.status === 204 ? null : await response.json();
  if (expectStatus && response.status !== expectStatus) {
    throw new Error(
      `${method} ${path} returned ${response.status}, expected ${expectStatus}: ${JSON.stringify(payload)}`,
    );
  }
  if (!response.ok && !expectStatus) {
    throw new Error(`${method} ${path} failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return { response, payload };
}

async function cleanup() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    if (created.appointment) await Appointment.deleteOne({ _id: created.appointment });
    if (created.encounter) await Encounter.deleteOne({ _id: created.encounter });
    if (created.invoice) await Invoice.deleteOne({ _id: created.invoice });
    if (created.consultationInvoice) await Invoice.deleteOne({ _id: created.consultationInvoice });
    if (created.walkInInvoice) await Invoice.deleteOne({ _id: created.walkInInvoice });
    if (created.queueEntry) await QueueEntry.deleteOne({ _id: created.queueEntry });
    if (created.walkInQueueEntry) await QueueEntry.deleteOne({ _id: created.walkInQueueEntry });
    if (created.inventoryItem) await InventoryItem.deleteOne({ _id: created.inventoryItem });
    if (created.labOrder) await LabOrder.deleteOne({ _id: created.labOrder });
    if (created.patient) await Patient.deleteOne({ _id: created.patient });
    if (created.settingsId) {
      await ClinicSettings.updateOne(
        { _id: created.settingsId },
        { $set: { defaultConsultationFee: created.originalConsultationFee } },
      );
    }
    if (created.smokeUser) await User.deleteOne({ _id: created.smokeUser });
  } finally {
    await mongoose.disconnect();
  }
}

try {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const smokeUser = await User.create({
      clinicId: process.env.DEFAULT_CLINIC_ID || '000000000000000000000001',
      name: 'ClinicOS Workflow Test',
      email,
      passwordHash: await bcrypt.hash(password, 12),
      roles: ['SUPER_ADMIN'],
      status: 'PASSWORD_RESET_REQUIRED',
    });
    created.smokeUser = smokeUser.id;
  } finally {
    await mongoose.disconnect();
  }
  const login = await request('/auth/login', { method: 'POST', body: { email, password } });
  if (!csrfToken) throw new Error('Login did not return a CSRF token');
  if (login.payload.user.passwordResetRequired) {
    const smokePassword = 'ClinicOS-Smoke-Password9!';
    await request('/auth/change-password', {
      method: 'POST',
      body: {
        currentPassword: password,
        newPassword: smokePassword,
        confirmPassword: smokePassword,
      },
    });
  }

  const patientResponse = await request('/patients', {
    method: 'POST',
    body: {
      fullName: 'ClinicOS Workflow Test',
      mobile: `+91${suffix.slice(-10)}`,
      gender: 'OTHER',
      dateOfBirth: '1990-01-01',
      bloodGroup: 'UNKNOWN',
      preferredLanguage: 'en',
    },
  });
  const patient = patientResponse.payload.patient;
  created.patient = patient.id;

  let doctors = (await request('/appointments/doctors')).payload.doctors;
  if (!doctors.length) throw new Error('No doctor account is available for workflow testing');
  if (!doctors.some((candidate) => candidate.consultationFee > 0)) {
    const settings = (await request('/settings')).payload.settings;
    created.settingsId = settings.id;
    created.originalConsultationFee = settings.defaultConsultationFee;
    await request('/settings', {
      method: 'PUT',
      body: { ...settings, defaultConsultationFee: 500 },
    });
    doctors = (await request('/appointments/doctors')).payload.doctors;
  }
  const doctor = doctors.find((candidate) => candidate.consultationFee > 0);
  if (!doctor) throw new Error('Could not configure a positive test consultation fee');
  const visitDate = dateInTimeZone(new Date(), process.env.CLINIC_TIMEZONE || 'Asia/Kolkata');

  const appointmentResponse = await request('/appointments', {
    method: 'POST',
    body: {
      patientId: patient.id,
      doctorId: doctor.id,
      date: visitDate,
      time: '10:30',
      reason: 'Workflow verification',
      visitType: 'NEW_CONSULTATION',
      reminderPreference: 'NONE',
    },
  });
  created.appointment = appointmentResponse.payload.appointment.id;

  const checkIn = await request(`/appointments/${created.appointment}/check-in`, {
    method: 'POST',
  });
  created.queueEntry = checkIn.payload.queueEntry.id;
  created.consultationInvoice = checkIn.payload.consultationInvoice?.id;
  if (checkIn.payload.queueEntry.state !== 'PAYMENT_PENDING' || !created.consultationInvoice) {
    throw new Error('Check-in did not create a fee-pending visit and consultation invoice');
  }
  const checkInReplay = await request(`/appointments/${created.appointment}/check-in`, {
    method: 'POST',
  });
  if (checkInReplay.payload.consultationInvoice?.id !== created.consultationInvoice) {
    throw new Error('Repeated check-in created another consultation invoice');
  }
  await request(`/queue/${created.queueEntry}/state`, {
    method: 'PATCH',
    body: { state: 'READY_FOR_DOCTOR' },
    expectStatus: 409,
  });
  const consultationPaymentPath = `/billing/invoices/${created.consultationInvoice}/payments`;
  const fee = doctor.consultationFee;
  const firstPayment = Math.round(fee * 50) / 100;
  await request(consultationPaymentPath, {
    method: 'POST',
    body: { amount: firstPayment, method: 'CASH', reference: 'SMOKE-PREVISIT-1' },
    headers: { 'idempotency-key': `smoke-previsit-first-${suffix}` },
  });
  const pendingAfterPartial = await request(`/queue/${created.queueEntry}`);
  if (pendingAfterPartial.payload.queueEntry.state !== 'PAYMENT_PENDING') {
    throw new Error('Partial payment released the visit before the fee was fully collected');
  }
  await request(consultationPaymentPath, {
    method: 'POST',
    body: {
      amount: Math.round((fee - firstPayment) * 100) / 100,
      method: 'CASH',
      reference: 'SMOKE-PREVISIT-2',
    },
    headers: { 'idempotency-key': `smoke-previsit-second-${suffix}` },
  });
  const released = await request(`/queue/${created.queueEntry}`);
  if (released.payload.queueEntry.state !== 'WAITING') {
    throw new Error('Full consultation payment did not release the visit to the doctor queue');
  }
  await request(`/queue/${created.queueEntry}/state`, {
    method: 'PATCH',
    body: { state: 'READY_FOR_DOCTOR' },
  });

  const encounterResponse = await request('/encounters', {
    method: 'POST',
    body: { queueEntryId: created.queueEntry },
  });
  created.encounter = encounterResponse.payload.encounter.id;
  await request(`/encounters/${created.encounter}`, {
    method: 'PATCH',
    body: {
      chiefComplaint: 'Routine workflow test',
      assessment: 'System workflow verified',
      diagnoses: ['Verification encounter'],
      prescriptions: [],
    },
  });
  await request(`/encounters/${created.encounter}/complete`, { method: 'POST' });

  const invoiceResponse = await request('/billing/invoices', {
    method: 'POST',
    body: {
      patientId: patient.id,
      queueEntryId: created.queueEntry,
      doctorId: doctor.id,
      items: [{ description: 'Follow-up lab service', quantity: 1, rate: 500 }],
      discount: 0,
    },
  });
  created.invoice = invoiceResponse.payload.invoice.id;
  const paymentPath = `/billing/invoices/${created.invoice}/payments`;
  const paymentHeaders = { 'idempotency-key': `smoke-payment-${suffix}` };
  await request(paymentPath, {
    method: 'POST',
    body: { amount: 500, method: 'CASH', reference: 'SMOKE-TEST' },
    headers: paymentHeaders,
  });
  const replay = await request(paymentPath, {
    method: 'POST',
    body: { amount: 500, method: 'CASH', reference: 'SMOKE-TEST' },
    headers: paymentHeaders,
  });
  if (!replay.payload.idempotentReplay || replay.payload.invoice.payments.length !== 1) {
    throw new Error('Payment idempotency replay did not preserve a single payment');
  }
  await request(paymentPath, {
    method: 'POST',
    body: { amount: 1, method: 'CASH', reference: 'DIFFERENT' },
    headers: paymentHeaders,
    expectStatus: 409,
  });

  const walkInKey = `smoke-walkin-${suffix}`;
  const walkInBody = {
    patientId: patient.id,
    doctorId: doctor.id,
    reason: 'Walk-in fee workflow verification',
    priority: 0,
  };
  const walkIn = await request('/queue', {
    method: 'POST',
    body: walkInBody,
    headers: { 'idempotency-key': walkInKey },
  });
  created.walkInQueueEntry = walkIn.payload.queueEntry.id;
  created.walkInInvoice = walkIn.payload.consultationInvoice?.id;
  if (walkIn.payload.queueEntry.state !== 'PAYMENT_PENDING' || !created.walkInInvoice) {
    throw new Error('Walk-in did not create a fee-pending visit and invoice');
  }
  const walkInReplay = await request('/queue', {
    method: 'POST',
    body: walkInBody,
    headers: { 'idempotency-key': walkInKey },
  });
  if (walkInReplay.payload.consultationInvoice?.id !== created.walkInInvoice) {
    throw new Error('Repeated walk-in registration created another consultation invoice');
  }
  await request(`/queue/${created.walkInQueueEntry}/state`, {
    method: 'PATCH',
    body: { state: 'CANCELLED', reason: 'Smoke test cleanup' },
  });
  const cancelledInvoice = await request(`/billing/invoices/${created.walkInInvoice}`);
  if (cancelledInvoice.payload.invoice.status !== 'CANCELLED') {
    throw new Error('Cancelling an unpaid visit did not cancel its invoice');
  }

  const inventoryResponse = await request('/inventory', {
    method: 'POST',
    body: { name: 'Workflow Test Medicine', sku: `TEST${suffix}`, reorderLevel: 2, unit: 'tablet' },
  });
  created.inventoryItem = inventoryResponse.payload.item.id;
  await request(`/inventory/${created.inventoryItem}/transactions`, {
    method: 'POST',
    body: { type: 'PURCHASE', quantity: 10, reason: 'Workflow verification' },
  });

  const labResponse = await request('/lab', {
    method: 'POST',
    body: { patientId: patient.id, testName: 'Workflow verification panel', priority: 'ROUTINE' },
  });
  created.labOrder = labResponse.payload.order.id;
  await request(`/lab/${created.labOrder}`, {
    method: 'PATCH',
    body: { status: 'VERIFIED', result: 'Verification result' },
  });

  await request(`/patients/search?query=${encodeURIComponent(patient.patientNumber)}`);
  await request(`/reports/summary?from=${visitDate}&to=${visitDate}`);
  await request('/audit?limit=5');
  await request('/settings');
  console.log(
    'ClinicOS workflow smoke test passed: password rotation → patient → appointment → previsit invoice → partial/full payment → doctor queue → consultation → follow-up invoice → walk-in/cancellation → inventory → lab → reports → audit.',
  );
} finally {
  await cleanup();
}
