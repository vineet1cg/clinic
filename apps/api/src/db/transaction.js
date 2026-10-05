import mongoose from 'mongoose';
import { logger } from '../config/logger.js';

/**
 * Executes a callback within a MongoDB multi-document transaction when supported
 * (e.g. in MongoDB Atlas or replica sets). If the deployment is standalone,
 * it safely falls back to executing without a session.
 */
export async function runInTransaction(callback) {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session?.inTransaction()) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        logger.debug({ abortError }, 'Error aborting transaction');
      }
    }

    const isUnsupported =
      error.message?.includes('Transaction numbers are only allowed on a replica set member') ||
      error.message?.includes('replica set') ||
      error.message?.includes('does not support retryable writes') ||
      error.code === 20;

    if (isUnsupported) {
      logger.debug('MongoDB replica set transactions unavailable; executing without session');
      return await callback(null);
    }

    throw error;
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}
