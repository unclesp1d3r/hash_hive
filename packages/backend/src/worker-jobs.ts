import { logger } from './config/logger.js';
import { createRedisClient } from './config/redis.js';
import { createHashListParserWorker } from './queue/workers/hash-list-parser.js';
import { createHeartbeatMonitorWorker } from './queue/workers/heartbeat-monitor.js';

const connection = createRedisClient('jobs-worker');

async function main() {
  await connection.connect();
  logger.info('Jobs worker connected to Redis');

  const hashListWorker = createHashListParserWorker(connection);
  logger.info('Hash list parser worker started');

  const heartbeatWorker = createHeartbeatMonitorWorker(connection);
  logger.info('Heartbeat monitor worker started');

  const workers = [hashListWorker, heartbeatWorker];

  async function shutdown(signal: string) {
    logger.info({ signal }, 'Shutting down job workers');
    await Promise.all(workers.map((w) => w.close()));
    connection.disconnect();
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Jobs worker failed to start');
  process.exit(1);
});
