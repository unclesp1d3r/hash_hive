import { Worker } from 'bullmq';
import type Redis from 'ioredis';
import { logger } from '../../config/logger.js';
import { QUEUE_NAMES } from '../../config/queue.js';
import { reassignStaleTasks } from '../../services/tasks.js';
import type { HeartbeatMonitorJob } from '../types.js';

export function createHeartbeatMonitorWorker(connection: Redis): Worker<HeartbeatMonitorJob> {
  const worker = new Worker<HeartbeatMonitorJob>(
    QUEUE_NAMES.HEARTBEAT_MONITOR,
    async (job) => {
      logger.info(
        { jobId: job.id, triggeredAt: job.data.triggeredAt },
        'Running heartbeat monitor'
      );

      const result = await reassignStaleTasks();

      if (result.reassigned > 0) {
        logger.info({ reassigned: result.reassigned }, 'Reassigned stale tasks');
      }

      return result;
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Heartbeat monitor job failed');
  });

  return worker;
}
