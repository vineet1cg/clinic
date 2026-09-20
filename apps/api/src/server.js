import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectMongo, disconnectMongo } from './db/mongoose.js';
import { closeQueues } from './queues/notification.queue.js';
import { closeRedisHealthClient, getRedisHealthClient } from './queues/redis.js';

let server;
let shuttingDown = false;

async function start() {
  await connectMongo();
  const redis = getRedisHealthClient();
  if (redis.status === 'wait') await redis.connect();
  await redis.ping();

  server = createServer(createApp());
  server.listen(env.PORT, env.HOST, () => {
    logger.info({ host: env.HOST, port: env.PORT }, 'ClinicOS API listening');
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down ClinicOS API');

  const forceExit = setTimeout(() => {
    logger.fatal('Graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  await Promise.allSettled([closeQueues(), closeRedisHealthClient(), disconnectMongo()]);
  clearTimeout(forceExit);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    shutdown(signal)
      .then(() => process.exit(0))
      .catch((error) => {
        logger.fatal({ error }, 'Graceful shutdown failed');
        process.exit(1);
      });
  });
}

start().catch((error) => {
  logger.fatal({ error }, 'ClinicOS API failed to start');
  process.exit(1);
});
