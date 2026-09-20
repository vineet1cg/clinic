import '../models/appointment.model.js';
import '../models/audit-log.model.js';
import '../models/clinic-settings.model.js';
import '../models/counter.model.js';
import '../models/encounter.model.js';
import '../models/inventory-item.model.js';
import '../models/invoice.model.js';
import '../models/lab-order.model.js';
import '../models/patient.model.js';
import '../models/queue-entry.model.js';
import '../models/user.model.js';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { connectMongo, disconnectMongo } from '../db/mongoose.js';

await connectMongo();

async function assertNoDuplicateIndexValues({ collection, field, bsonType, description }) {
  const duplicates = await collection
    .aggregate([
      ...(field.includes('.') ? [{ $unwind: `$${field.split('.')[0]}` }] : []),
      { $match: { [field]: { $type: bsonType } } },
      {
        $group: {
          _id: { clinicId: '$clinicId', value: `$${field}` },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $limit: 1 },
    ])
    .toArray();

  if (duplicates.length > 0) {
    throw new Error(`Duplicate ${description} values exist; resolve them before creating indexes`);
  }
}

async function migrateOptionalUniqueIndex({
  collectionName,
  field,
  bsonType,
  desiredName,
  description,
}) {
  const exists = await mongoose.connection.db
    .listCollections({ name: collectionName }, { nameOnly: true })
    .hasNext();
  if (!exists) return;

  const collection = mongoose.connection.collection(collectionName);
  await assertNoDuplicateIndexValues({ collection, field, bsonType, description });

  const indexes = await collection.indexes();
  const legacyIndex = indexes.find(
    (index) => index.key?.clinicId === 1 && index.key?.[field] === 1 && index.name !== desiredName,
  );

  if (legacyIndex) {
    await collection.dropIndex(legacyIndex.name);
    logger.warn(
      { collection: collectionName, index: legacyIndex.name },
      'Replaced legacy optional-value index',
    );
  }
}

try {
  const auditLogsExist = await mongoose.connection.db
    .listCollections({ name: 'auditlogs' }, { nameOnly: true })
    .hasNext();
  if (auditLogsExist) {
    const migration = await mongoose.connection
      .collection('auditlogs')
      .updateMany(
        { clinicId: null },
        { $set: { clinicId: new mongoose.Types.ObjectId(env.DEFAULT_CLINIC_ID) } },
      );
    if (migration.modifiedCount > 0) {
      logger.warn(
        { records: migration.modifiedCount },
        'Assigned legacy unscoped audit records to the default clinic',
      );
    }
  }

  await migrateOptionalUniqueIndex({
    collectionName: 'invoices',
    field: 'payments.idempotencyKey',
    bsonType: 'string',
    desiredName: 'invoice_payment_idempotency_unique',
    description: 'invoice payment idempotency key',
  });
  await migrateOptionalUniqueIndex({
    collectionName: 'patients',
    field: 'openemrPatientId',
    bsonType: 'string',
    desiredName: 'patient_openemr_id_unique',
    description: 'patient OpenEMR ID',
  });
  await migrateOptionalUniqueIndex({
    collectionName: 'queueentries',
    field: 'appointmentId',
    bsonType: 'objectId',
    desiredName: 'queue_appointment_unique',
    description: 'queue appointment ID',
  });

  for (const model of Object.values(mongoose.models)) {
    await model.createIndexes();
    logger.info({ model: model.modelName }, 'MongoDB indexes verified');
  }
} finally {
  await disconnectMongo();
}
