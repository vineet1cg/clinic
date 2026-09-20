import { LAB_STATUSES, PERMISSIONS } from '@clinicos/contracts';
import { AppError } from '../../common/app-error.js';
import { getClinicId } from '../../common/clinic-context.js';
import { nextSequence } from '../../models/counter.model.js';
import { Encounter } from '../../models/encounter.model.js';
import { LabOrder } from '../../models/lab-order.model.js';
import { Patient } from '../../models/patient.model.js';
import { writeAuditEntry } from '../audit/audit.service.js';
import { resolvePermissions } from '../auth/auth.service.js';

const labPopulation = [{ path: 'patientId', select: 'patientNumber fullName mobile' }];

export async function listLabOrders(req, res) {
  const filter = { clinicId: getClinicId(req.user) };
  if (req.validated.query.status) filter.status = req.validated.query.status;
  const orders = await LabOrder.find(filter)
    .populate(labPopulation)
    .sort({ createdAt: -1 })
    .limit(500);
  res.json({ orders });
}

export async function createLabOrder(req, res) {
  const clinicId = getClinicId(req.user);
  const patient = await Patient.findOne({ _id: req.body.patientId, clinicId });
  if (!patient)
    throw new AppError({
      code: 'PATIENT_NOT_FOUND',
      message: 'Patient was not found.',
      statusCode: 404,
    });
  if (req.body.encounterId) {
    const encounter = await Encounter.findOne({
      _id: req.body.encounterId,
      clinicId,
      patientId: patient._id,
    });
    if (!encounter) {
      throw new AppError({
        code: 'LAB_ENCOUNTER_MISMATCH',
        message: 'The consultation was not found for this patient.',
        statusCode: 409,
      });
    }
  }
  const sequence = await nextSequence(`${clinicId}:lab`);
  const order = await LabOrder.create({
    ...req.body,
    clinicId,
    orderNumber: `LAB${String(sequence).padStart(6, '0')}`,
    orderedBy: req.user._id,
  });
  await order.populate(labPopulation);
  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'lab.order',
    resourceType: 'lab_order',
    resourceId: order.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.status(201).json({ order });
}

export async function updateLabOrder(req, res) {
  const clinicId = getClinicId(req.user);
  const permissions = resolvePermissions(req.user);
  const order = await LabOrder.findOne({ _id: req.params.id, clinicId });
  if (!order)
    throw new AppError({
      code: 'LAB_ORDER_NOT_FOUND',
      message: 'Lab order was not found.',
      statusCode: 404,
    });
  if ([LAB_STATUSES.VERIFIED, LAB_STATUSES.CANCELLED].includes(order.status)) {
    throw new AppError({
      code: 'LAB_ORDER_READ_ONLY',
      message: 'Verified or cancelled lab orders cannot be changed.',
      statusCode: 409,
    });
  }

  const isVerification = req.body.status === LAB_STATUSES.VERIFIED;
  const canCreateResult = permissions.includes(PERMISSIONS.LAB_RESULT_CREATE);
  const canVerifyResult = permissions.includes(PERMISSIONS.LAB_RESULT_VERIFY);
  if (isVerification && !canVerifyResult) {
    throw new AppError({
      code: 'LAB_VERIFICATION_FORBIDDEN',
      message: 'You do not have permission to verify lab results.',
      statusCode: 403,
    });
  }
  if ((!isVerification || req.body.result !== undefined) && !canCreateResult) {
    throw new AppError({
      code: 'LAB_RESULT_UPDATE_FORBIDDEN',
      message: 'You do not have permission to update lab results.',
      statusCode: 403,
    });
  }

  if (req.body.result !== undefined) order.result = req.body.result;
  order.status = req.body.status;
  if (isVerification) {
    if (!order.result)
      throw new AppError({
        code: 'LAB_RESULT_REQUIRED',
        message: 'Enter a result before verification.',
        statusCode: 422,
      });
    order.verifiedBy = req.user._id;
    order.verifiedAt = new Date();
  }
  await order.save();
  await order.populate(labPopulation);
  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'lab.update',
    resourceType: 'lab_order',
    resourceId: order.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { status: req.body.status },
  });
  res.json({ order });
}
