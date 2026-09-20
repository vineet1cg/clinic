import { AuditLog } from '../../models/audit-log.model.js';

const safeMetadataKeys = new Set([
  'amount',
  'fields',
  'from',
  'method',
  'quantity',
  'queueEntryId',
  'reason',
  'resultCount',
  'roles',
  'sections',
  'source',
  'status',
  'to',
  'total',
  'type',
]);

function safeScalar(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  return value.slice(0, 120);
}

export function sanitizeAuditMetadata(metadata = {}) {
  return Object.fromEntries(
    Object.entries(metadata).flatMap(([key, value]) => {
      if (!safeMetadataKeys.has(key)) return [];
      if (key === 'reason' && !/^[a-z][a-z0-9_]{0,79}$/i.test(value)) return [];
      if (Array.isArray(value)) {
        return [
          [
            key,
            value
              .slice(0, 30)
              .map(safeScalar)
              .filter((item) => item !== undefined),
          ],
        ];
      }
      const safeValue = safeScalar(value);
      return safeValue === undefined ? [] : [[key, safeValue]];
    }),
  );
}

export async function writeAuditEntry({
  clinicId,
  actorId,
  action,
  resourceType,
  resourceId,
  ipAddress,
  userAgent,
  metadata = {},
}) {
  return AuditLog.create({
    clinicId,
    actorId,
    action: String(action).slice(0, 120),
    resourceType: String(resourceType).slice(0, 80),
    resourceId: resourceId ? String(resourceId).slice(0, 120) : undefined,
    ipAddress: ipAddress ? String(ipAddress).slice(0, 64) : undefined,
    userAgent: userAgent ? String(userAgent).slice(0, 300) : undefined,
    metadata: sanitizeAuditMetadata(metadata),
  });
}
