import { http } from './http.js';

export async function searchPatients(query) {
  const response = await http.get('/patients/search', { params: { query } });
  return response.data.patients;
}

export async function createPatient(input) {
  const response = await http.post('/patients', input);
  return response.data.patient;
}

export async function getPatient(id) {
  const response = await http.get(`/patients/${id}`);
  return response.data;
}

export async function listDoctors() {
  const response = await http.get('/appointments/doctors');
  return response.data.doctors;
}

export async function getSchedulingContext() {
  const response = await http.get('/appointments/doctors');
  return response.data;
}

export async function listAppointments(params = {}) {
  const response = await http.get('/appointments', { params });
  return response.data.appointments;
}

export async function createAppointment(input) {
  const response = await http.post('/appointments', input);
  return response.data.appointment;
}

export async function checkInAppointment(id) {
  const response = await http.post(`/appointments/${id}/check-in`);
  return response.data;
}

export async function cancelAppointment(id, reason) {
  const response = await http.post(`/appointments/${id}/cancel`, { reason });
  return response.data.appointment;
}

export async function listQueue(params = {}) {
  const response = await http.get('/queue/today', { params });
  return response.data.queue;
}

export async function getPublicQueue(doctorId) {
  const response = await http.get(`/queue/display/${doctorId}`);
  return response.data;
}

export async function createWalkIn(input, idempotencyKey) {
  const response = await http.post('/queue', input, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return response.data;
}

export async function recoverConsultationInvoice(queueEntryId) {
  const response = await http.post(`/queue/${queueEntryId}/consultation-invoice`);
  return response.data.consultationInvoice;
}

export async function transitionQueue(id, state, reason) {
  const response = await http.patch(`/queue/${id}/state`, { state, ...(reason ? { reason } : {}) });
  return response.data.queueEntry;
}

export async function getEncounterForQueue(queueId) {
  const response = await http.get(`/encounters/queue/${queueId}`);
  return response.data;
}

export async function startEncounter(queueEntryId) {
  const response = await http.post('/encounters', { queueEntryId });
  return response.data.encounter;
}

export async function saveEncounter(id, input) {
  const response = await http.patch(`/encounters/${id}`, input);
  return response.data.encounter;
}

export async function saveVitals(id, input) {
  const response = await http.post(`/encounters/${id}/vitals`, input);
  return response.data.encounter;
}

export async function completeEncounter(id) {
  const response = await http.post(`/encounters/${id}/complete`);
  return response.data.encounter;
}

export async function listInvoices(params = {}) {
  const response = await http.get('/billing/invoices', { params });
  return response.data.invoices;
}

export async function createInvoice(input) {
  const response = await http.post('/billing/invoices', input);
  return response.data.invoice;
}

export async function getInvoice(id) {
  const response = await http.get(`/billing/invoices/${id}`);
  return response.data.invoice;
}

export async function collectPayment(id, input, idempotencyKey) {
  const response = await http.post(`/billing/invoices/${id}/payments`, input, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return response.data.invoice;
}

export async function voidInvoice(id, input) {
  const response = await http.post(`/billing/invoices/${id}/void`, input);
  return response.data.invoice;
}

export async function refundInvoice(id, input) {
  const response = await http.post(`/billing/invoices/${id}/refund`, input);
  return response.data.invoice;
}

export async function getReportSummary(params = {}) {
  const response = await http.get('/reports/summary', { params });
  return response.data;
}

export async function getDashboardSummary() {
  const response = await http.get('/reports/dashboard');
  return response.data;
}

export async function listStaff(params = {}) {
  const response = await http.get('/staff', { params });
  return response.data.staff;
}

export async function createStaff(input) {
  const response = await http.post('/staff', input);
  return response.data.staffMember;
}

export async function updateStaff(id, input) {
  const response = await http.patch(`/staff/${id}`, input);
  return response.data.staffMember;
}

export async function listRoles() {
  const response = await http.get('/staff/roles');
  return response.data.roles;
}

export async function getSettings() {
  const response = await http.get('/settings');
  return response.data.settings;
}

export async function updateSettings(input) {
  const response = await http.put('/settings', input);
  return response.data.settings;
}

export async function listInventory() {
  const response = await http.get('/inventory');
  return response.data.inventory;
}

export async function createInventoryItem(input) {
  const response = await http.post('/inventory', input);
  return response.data.item;
}

export async function recordInventoryTransaction(id, input) {
  const response = await http.post(`/inventory/${id}/transactions`, input);
  return response.data.item;
}

export async function listPendingPrescriptions() {
  const response = await http.get('/inventory/prescriptions/pending');
  return response.data.pending;
}

export async function dispensePrescription(encounterId, prescriptionId, input) {
  const response = await http.post(
    `/inventory/prescriptions/${encounterId}/${prescriptionId}/dispense`,
    input,
  );
  return response.data;
}

export async function listLabOrders(params = {}) {
  const response = await http.get('/lab', { params });
  return response.data.orders;
}

export async function createLabOrder(input) {
  const response = await http.post('/lab', input);
  return response.data.order;
}

export async function updateLabOrder(id, input) {
  const response = await http.patch(`/lab/${id}`, input);
  return response.data.order;
}

export async function listAuditLogs(params = {}) {
  const response = await http.get('/audit', { params });
  return response.data;
}
