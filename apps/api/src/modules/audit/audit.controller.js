import { getClinicId } from '../../common/clinic-context.js';
import { AuditLog } from '../../models/audit-log.model.js';
import { sanitizeAuditMetadata, writeAuditEntry } from './audit.service.js';

export async function listAuditLogs(req, res) {
  const clinicId = getClinicId(req.user);
  const { cursor, limit, action, resourceType, actorId, from, to } = req.validated.query;
  const filter = { clinicId };
  if (cursor) filter._id = { $lt: cursor };
  if (action) filter.action = action;
  if (resourceType) filter.resourceType = resourceType;
  if (actorId) filter.actorId = actorId;
  if (from || to) {
    filter.createdAt = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lte: new Date(to) } : {}),
    };
  }

  const rows = await AuditLog.find(filter)
    .populate('actorId', 'name email')
    .sort({ _id: -1 })
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const visibleRows = hasMore ? rows.slice(0, limit) : rows;
  const auditLogs = visibleRows.map((row) => ({
    id: row.id,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId || null,
    actor: row.actorId
      ? { id: row.actorId.id, name: row.actorId.name, email: row.actorId.email }
      : null,
    ipAddress: row.ipAddress || null,
    userAgent: row.userAgent || null,
    metadata: sanitizeAuditMetadata(row.metadata),
    createdAt: row.createdAt,
  }));

  await writeAuditEntry({
    clinicId,
    actorId: req.user._id,
    action: 'audit.view',
    resourceType: 'audit_log',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { resultCount: auditLogs.length },
  });

  res.json({
    auditLogs,
    nextCursor: hasMore ? visibleRows.at(-1).id : null,
  });
}
