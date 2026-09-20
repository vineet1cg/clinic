import { getClinicId } from '../../common/clinic-context.js';
import { ClinicSettings } from '../../models/clinic-settings.model.js';
import { writeAuditEntry } from '../audit/audit.service.js';

const defaults = {
  clinicName: 'Your Clinic',
  address: '',
  phone: '',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  tokenPrefix: 'A',
  defaultConsultationFee: 0,
  language: 'en',
  receiptFormat: 'A5',
  prescriptionFooter: '',
  invoiceFooter: '',
};

export async function getSettings(req, res) {
  const clinicId = getClinicId(req.user);
  const settings = await ClinicSettings.findOneAndUpdate(
    { clinicId },
    { $setOnInsert: { ...defaults, clinicId } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  );
  res.json({ settings });
}

export async function updateSettings(req, res) {
  const clinicId = getClinicId(req.user);
  const settings = await ClinicSettings.findOneAndUpdate(
    { clinicId },
    { ...req.body, clinicId, updatedBy: req.user._id },
    { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'settings.update',
    resourceType: 'clinic_settings',
    resourceId: settings.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { fields: Object.keys(req.body) },
  });
  res.json({ settings });
}
