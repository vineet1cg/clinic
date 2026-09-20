import {
  APPOINTMENT_STATUSES,
  PERMISSIONS,
  QUEUE_STATES,
  USER_ROLES,
  USER_STATUSES,
} from '@clinicos/contracts';
import { getClinicId } from '../../common/clinic-context.js';
import { clinicDateRange, clinicToday } from '../../common/clinic-time.js';
import { Appointment } from '../../models/appointment.model.js';
import { Invoice } from '../../models/invoice.model.js';
import { Patient } from '../../models/patient.model.js';
import { QueueEntry } from '../../models/queue-entry.model.js';
import { User } from '../../models/user.model.js';
import { resolvePermissions } from '../auth/auth.service.js';

async function dateRange(clinicId, query) {
  const today = await clinicToday(clinicId);
  const from = query.from || today;
  const to = query.to || from;
  return {
    from,
    to,
    createdAt: await clinicDateRange(clinicId, from, to),
  };
}

export async function getReportSummary(req, res) {
  const clinicId = getClinicId(req.user);
  const range = await dateRange(clinicId, req.validated.query);
  const permissions = resolvePermissions(req.user);
  const canViewOperational = permissions.includes(PERMISSIONS.REPORT_OPERATIONAL);
  const canViewFinancial = permissions.includes(PERMISSIONS.REPORT_FINANCIAL);
  const [
    registeredPatients,
    appointmentCounts,
    queueCounts,
    queueDurations,
    revenue,
    outstanding,
    doctorsActive,
  ] = await Promise.all([
    canViewOperational ? Patient.countDocuments({ clinicId, createdAt: range.createdAt }) : 0,
    canViewOperational
      ? Appointment.aggregate([
          { $match: { clinicId, date: { $gte: range.from, $lte: range.to } } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
      : [],
    canViewOperational
      ? QueueEntry.aggregate([
          { $match: { clinicId, queueDate: { $gte: range.from, $lte: range.to } } },
          { $group: { _id: '$state', count: { $sum: 1 } } },
        ])
      : [],
    canViewOperational
      ? QueueEntry.aggregate([
          {
            $match: {
              clinicId,
              queueDate: { $gte: range.from, $lte: range.to },
              consultationStartedAt: { $exists: true },
              checkInAt: { $exists: true },
            },
          },
          {
            $project: {
              waitMinutes: {
                $divide: [{ $subtract: ['$consultationStartedAt', '$checkInAt'] }, 60_000],
              },
            },
          },
          { $group: { _id: null, average: { $avg: '$waitMinutes' } } },
        ])
      : [],
    canViewFinancial
      ? Invoice.aggregate([
          { $match: { clinicId } },
          { $unwind: '$payments' },
          { $match: { 'payments.collectedAt': range.createdAt } },
          { $group: { _id: '$payments.method', amount: { $sum: '$payments.amount' } } },
        ])
      : [],
    canViewFinancial
      ? Invoice.aggregate([
          {
            $match: { clinicId, balance: { $gt: 0 }, status: { $nin: ['CANCELLED', 'REFUNDED'] } },
          },
          { $group: { _id: null, amount: { $sum: '$balance' } } },
        ])
      : [],
    canViewOperational
      ? User.countDocuments({ clinicId, roles: USER_ROLES.DOCTOR, status: USER_STATUSES.ACTIVE })
      : 0,
  ]);

  const appointments = Object.fromEntries(appointmentCounts.map((row) => [row._id, row.count]));
  const queue = Object.fromEntries(queueCounts.map((row) => [row._id, row.count]));
  const revenueByMethod = Object.fromEntries(revenue.map((row) => [row._id, row.amount]));
  const revenueTotal = revenue.reduce((total, row) => total + row.amount, 0);
  const completed = (queue[QUEUE_STATES.COMPLETED] || 0) + (queue[QUEUE_STATES.PAID] || 0);

  res.json({
    range: { from: range.from, to: range.to },
    access: { operational: canViewOperational, financial: canViewFinancial },
    metrics: {
      registeredPatients: canViewOperational ? registeredPatients : null,
      appointments: canViewOperational
        ? Object.values(appointments).reduce((total, count) => total + count, 0)
        : null,
      cancelledAppointments: canViewOperational
        ? appointments[APPOINTMENT_STATUSES.CANCELLED] || 0
        : null,
      walkIns: canViewOperational
        ? Math.max(
            0,
            Object.values(queue).reduce((total, count) => total + count, 0) -
              (appointments[APPOINTMENT_STATUSES.CHECKED_IN] || 0),
          )
        : null,
      waiting: canViewOperational
        ? (queue[QUEUE_STATES.WAITING] || 0) + (queue[QUEUE_STATES.READY_FOR_DOCTOR] || 0)
        : null,
      completed: canViewOperational ? completed : null,
      averageWaitMinutes: canViewOperational ? Math.round(queueDurations[0]?.average || 0) : null,
      revenue: canViewFinancial ? revenueTotal : null,
      outstanding: canViewFinancial ? outstanding[0]?.amount || 0 : null,
      doctorsActive: canViewOperational ? doctorsActive : null,
    },
    queueByState: canViewOperational ? queue : {},
    appointmentsByStatus: canViewOperational ? appointments : {},
    revenueByMethod: canViewFinancial ? revenueByMethod : {},
  });
}

export async function getDashboardSummary(req, res) {
  const clinicId = getClinicId(req.user);
  const date = await clinicToday(clinicId);
  const permissions = resolvePermissions(req.user);
  const canSeeOperations =
    permissions.includes(PERMISSIONS.QUEUE_VIEW) ||
    permissions.includes(PERMISSIONS.REPORT_OPERATIONAL);
  const canSeeRevenue = permissions.includes(PERMISSIONS.REPORT_FINANCIAL);
  const paymentDateRange = canSeeRevenue ? await clinicDateRange(clinicId, date, date) : undefined;
  const [queue, appointments, paymentTotals] = await Promise.all([
    canSeeOperations
      ? QueueEntry.aggregate([
          { $match: { clinicId, queueDate: date } },
          { $group: { _id: '$state', count: { $sum: 1 } } },
        ])
      : [],
    canSeeOperations ? Appointment.countDocuments({ clinicId, date }) : 0,
    canSeeRevenue
      ? Invoice.aggregate([
          { $match: { clinicId } },
          { $unwind: '$payments' },
          {
            $match: {
              'payments.collectedAt': paymentDateRange,
            },
          },
          { $group: { _id: null, amount: { $sum: '$payments.amount' } } },
        ])
      : [],
  ]);
  const byState = Object.fromEntries(queue.map((row) => [row._id, row.count]));
  res.json({
    date,
    access: { operational: canSeeOperations, financial: canSeeRevenue },
    metrics: {
      patientsToday: canSeeOperations
        ? Object.values(byState).reduce((total, count) => total + count, 0)
        : null,
      appointments: canSeeOperations ? appointments : null,
      waiting: canSeeOperations
        ? (byState[QUEUE_STATES.WAITING] || 0) +
          (byState[QUEUE_STATES.VITALS_PENDING] || 0) +
          (byState[QUEUE_STATES.VITALS_COMPLETE] || 0) +
          (byState[QUEUE_STATES.READY_FOR_DOCTOR] || 0)
        : null,
      completed: canSeeOperations ? byState[QUEUE_STATES.COMPLETED] || 0 : null,
      revenue: canSeeRevenue ? paymentTotals[0]?.amount || 0 : null,
    },
  });
}
