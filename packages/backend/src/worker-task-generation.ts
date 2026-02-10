import { logger } from './config/logger.js';
import { QUEUE_NAMES } from './config/queue.js';
import { createRedisClient } from './config/redis.js';
import { createTaskGeneratorWorker } from './queue/workers/task-generator.js';

const connection = createRedisClient('worker:task-generation');

async function main() {
  await connection.connect();
  logger.info('Starting task-generation worker process');

  // Single worker consuming the dedicated task-generation job queue.
  // Job priority is handled via BullMQ's built-in priority option on the queue.
  const worker = createTaskGeneratorWorker(connection, QUEUE_NAMES.TASK_GENERATION);

  async function handleShutdown(signal: string) {
    logger.info({ signal }, 'Shutting down task-generation worker');
    await worker.close();
    connection.disconnect();
    process.exit(0);
  }

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  logger.info(
    { queue: QUEUE_NAMES.TASK_GENERATION },
    'Task-generation worker running on dedicated job queue'
  );
}

main().catch((err) => {
  logger.error({ err }, 'Task-generation worker failed to start');
  process.exit(1);
});
