import { randomUUID } from 'crypto';
import { Queue, QueueEvents, Worker, type Job, type ConnectionOptions } from 'bullmq';
import { config } from './index';
import { logger } from '../utils/logger';

/**
 * Queue names used throughout the application
 */
export const QUEUE_NAMES = {
  TASKS: 'tasks',
  HASH_IMPORT: 'hash-import',
  RESOURCE_PROCESSING: 'resource-processing',
  DEAD_LETTER: 'dead-letter',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * BullMQ connection configuration
 */
const getConnectionOptions = (): ConnectionOptions => {
  const options: ConnectionOptions = {
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null, // BullMQ requires this to be null for blocking operations
  };

  if (config.redis.password !== '' && config.redis.password !== undefined) {
    options.password = config.redis.password;
  }

  return options;
};

/**
 * Queue instances registry
 */
const queues = new Map<QueueName, Queue>();
const queueEvents = new Map<QueueName, QueueEvents>();
const workers = new Map<string, Worker>();

/**
 * Default queue options
 */
const defaultQueueOptions = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 1000,
    },
    removeOnComplete: {
      age: 86400, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 604800, // Keep failed jobs for 7 days
      count: 5000, // Keep last 5000 failed jobs
    },
  },
};

/**
 * Initialize a queue with the given name
 */
export const createQueue = (name: QueueName): Queue => {
  const existingQueue = queues.get(name);
  if (existingQueue !== undefined) {
    return existingQueue;
  }

  logger.info({ queueName: name }, 'Creating queue');

  const queue = new Queue(name, {
    connection: getConnectionOptions(),
    ...defaultQueueOptions,
  });

  // Set up queue event listeners for monitoring
  const events = new QueueEvents(name, { connection: getConnectionOptions() });

  events.on('waiting', ({ jobId }) => {
    logger.debug({ queueName: name, jobId }, 'Job waiting');
  });

  events.on('active', ({ jobId }) => {
    logger.debug({ queueName: name, jobId }, 'Job active');
  });

  events.on('completed', ({ jobId, returnvalue }) => {
    logger.info({ queueName: name, jobId, returnvalue }, 'Job completed');
  });

  events.on('failed', ({ jobId, failedReason }) => {
    logger.error({ queueName: name, jobId, failedReason }, 'Job failed');
  });

  events.on('progress', ({ jobId, data }) => {
    logger.debug({ queueName: name, jobId, progress: data }, 'Job progress');
  });

  events.on('stalled', ({ jobId }) => {
    logger.warn({ queueName: name, jobId }, 'Job stalled');
  });

  queues.set(name, queue);
  queueEvents.set(name, events);

  return queue;
};

/**
 * Get an existing queue instance
 */
export const getQueue = (name: QueueName): Queue => {
  const queue = queues.get(name);
  if (queue === undefined) {
    throw new Error(`Queue "${name}" not initialized. Call createQueue() first.`);
  }
  return queue;
};

/**
 * Initialize all default queues
 */
export const initializeQueues = (): void => {
  logger.info('Initializing BullMQ queues...');

  // Create all default queues
  Object.values(QUEUE_NAMES).forEach((queueName) => {
    createQueue(queueName);
  });

  logger.info({ queues: Object.values(QUEUE_NAMES) }, '✅ BullMQ queues initialized successfully');
};

/**
 * Register a worker for a specific queue
 */
export const registerWorker = <T = unknown, R = unknown>(
  queueName: QueueName,
  processor: (job: Job<T>) => Promise<R>,
  options?: {
    concurrency?: number;
    limiter?: {
      max: number;
      duration: number;
    };
  }
): Worker<T, R> => {
  const workerId = `${queueName}-worker-${randomUUID()}`;

  logger.info({ queueName, workerId }, 'Registering worker');

  const workerOptions: {
    connection: ConnectionOptions;
    concurrency: number;
    limiter?: {
      max: number;
      duration: number;
    };
  } = {
    connection: getConnectionOptions(),
    concurrency: options?.concurrency ?? 1,
  };

  if (options?.limiter !== undefined) {
    workerOptions.limiter = options.limiter;
  }

  const worker = new Worker<T, R>(queueName, processor, workerOptions);

  // Worker event handlers
  worker.on('completed', (job) => {
    logger.info({ queueName, jobId: job.id }, 'Worker completed job');
  });

  worker.on('failed', (job, error) => {
    logger.error({ queueName, jobId: job?.id, error }, 'Worker failed to process job');
  });

  worker.on('error', (error) => {
    logger.error({ queueName, workerId, error }, 'Worker error');
  });

  workers.set(workerId, worker);

  return worker;
};

/**
 * Move a failed job to the dead-letter queue
 */
export const moveToDeadLetterQueue = async (job: Job<unknown>, reason: string): Promise<void> => {
  const deadLetterQueue = getQueue(QUEUE_NAMES.DEAD_LETTER);

  try {
    await deadLetterQueue.add(
      'dead-letter-job',
      {
        originalQueue: job.queueName,
        originalJobId: job.id,
        originalData: job.data as Record<string, unknown>,
        failedReason: reason,
        failedAt: new Date().toISOString(),
        attemptsMade: job.attemptsMade,
      },
      {
        removeOnComplete: false, // Keep dead-letter jobs indefinitely
        removeOnFail: false,
      }
    );

    // Only remove the original job if the dead-letter add succeeded
    try {
      await job.remove();
    } catch (removeError) {
      logger.error(
        {
          originalQueue: job.queueName,
          originalJobId: job.id,
          error: removeError,
        },
        'Failed to remove original job after moving to dead-letter queue'
      );
      throw removeError;
    }

    logger.warn(
      {
        originalQueue: job.queueName,
        originalJobId: job.id,
        reason,
      },
      'Job moved to dead-letter queue'
    );
  } catch (error) {
    logger.error(
      {
        originalQueue: job.queueName,
        originalJobId: job.id,
        reason,
        error,
      },
      'Failed to move job to dead-letter queue'
    );
    throw error;
  }
};

/**
 * Get queue metrics for monitoring
 */
export const getQueueMetrics = async (
  queueName: QueueName
): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> => {
  const queue = getQueue(queueName);

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
  };
};

/**
 * Get metrics for all queues
 */
export const getAllQueueMetrics = async (): Promise<
  Record<QueueName, Awaited<ReturnType<typeof getQueueMetrics>>>
> => {
  const metrics: Record<
    string,
    {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    }
  > = {};

  for (const queueName of queues.keys()) {
    metrics[queueName] = await getQueueMetrics(queueName);
  }

  return metrics;
};

/**
 * Close all queues and workers gracefully
 */
export const closeQueues = async (): Promise<void> => {
  logger.info('Closing BullMQ queues and workers...');

  // Close all workers first
  const workerClosePromises = Array.from(workers.values()).map(async (worker) => {
    try {
      await worker.close();
    } catch (error) {
      logger.error({ error }, 'Error closing worker');
    }
  });

  await Promise.all(workerClosePromises);
  workers.clear();

  // Close all queue events
  const eventsClosePromises = Array.from(queueEvents.values()).map(async (events) => {
    try {
      await events.close();
    } catch (error) {
      logger.error({ error }, 'Error closing queue events');
    }
  });

  await Promise.all(eventsClosePromises);
  queueEvents.clear();

  // Close all queues
  const queueClosePromises = Array.from(queues.values()).map(async (queue) => {
    try {
      await queue.close();
    } catch (error) {
      logger.error({ error }, 'Error closing queue');
    }
  });

  await Promise.all(queueClosePromises);
  queues.clear();

  logger.info('BullMQ queues and workers closed successfully');
};

/**
 * Health check for queue system
 */
export const checkQueueHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  queues?: Record<
    QueueName,
    {
      status: string;
      metrics: {
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
      };
    }
  >;
  error?: string;
}> => {
  try {
    const queueStatuses: Record<
      string,
      {
        status: string;
        metrics: {
          waiting: number;
          active: number;
          completed: number;
          failed: number;
          delayed: number;
        };
      }
    > = {};

    for (const [name, queue] of queues.entries()) {
      const metrics = await getQueueMetrics(name);
      const client = await queue.client;
      queueStatuses[name] = {
        status: client.status,
        metrics,
      };
    }

    return {
      status: 'healthy',
      queues: queueStatuses,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
