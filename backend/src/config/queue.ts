/* eslint-disable @typescript-eslint/prefer-destructuring -- Queue config uses imperative property access where destructuring adds little value */
import { randomUUID } from 'node:crypto';
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
  const { host, port, password } = config.redis;

  const options: ConnectionOptions = {
    host,
    port,
    maxRetriesPerRequest: null, // BullMQ requires this to be null for blocking operations
  };

  if (password !== '' && password !== undefined) {
    options.password = password;
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
 * Helper to detect and suppress expected connection-closed errors that can
 * occur during normal shutdown when Redis connections are being torn down.
 */
const isConnectionClosedError = (error: Error & { context?: Error }): boolean => {
  const errorMessage = error.message;
  const contextMessage = error.context?.message ?? '';

  const hasConnectionClosedMessage =
    errorMessage.includes('Connection is closed') ||
    contextMessage.includes('Connection is closed');

  // BullMQ sometimes wraps the underlying error in an "Unhandled error" wrapper
  // while keeping the original message in the context object, so we treat both
  // forms as equivalent for suppression purposes.
  if (hasConnectionClosedMessage) {
    return true;
  }

  if (errorMessage.includes('Unhandled error') && contextMessage.includes('Connection is closed')) {
    return true;
  }

  return false;
};

const DEFAULT_JOB_ATTEMPTS = 3;
const DEFAULT_BACKOFF_DELAY_MS = 1000;
const COMPLETED_JOB_TTL_SECONDS = 86400; // 24 hours
const FAILED_JOB_TTL_SECONDS = 604800; // 7 days
const MAX_COMPLETED_JOBS = 1000;
const MAX_FAILED_JOBS = 5000;
const DEFAULT_WORKER_CONCURRENCY = 1;
const QUEUE_CLOSE_DELAY_MS = 250; // Delay after closing queues to allow connections to fully close

/**
 * Default queue options
 */
const defaultQueueOptions = {
  defaultJobOptions: {
    attempts: DEFAULT_JOB_ATTEMPTS,
    backoff: {
      type: 'exponential' as const,
      delay: DEFAULT_BACKOFF_DELAY_MS,
    },
    removeOnComplete: {
      age: COMPLETED_JOB_TTL_SECONDS,
      count: MAX_COMPLETED_JOBS, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: FAILED_JOB_TTL_SECONDS,
      count: MAX_FAILED_JOBS, // Keep last 5000 failed jobs
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

  // Ensure we always handle queue-level error events so they don't crash the
  // process or surface as unhandled errors in tests when connections are
  // closed as part of normal shutdown.
  queue.on('error', (error: Error & { context?: Error }) => {
    if (isConnectionClosedError(error)) {
      logger.debug({ queueName: name }, 'Queue connection closed (expected during shutdown)');
      return;
    }
    logger.error({ queueName: name, error }, 'Queue error');
  });

  // Queue events are helpful for observability, but can introduce noisy
  // connection-close errors in test environments due to rapid setup/teardown.
  // Skip creating QueueEvents during tests to keep CI stable.
  if (!config.server.isTest) {
    // Set up queue event listeners for monitoring
    const events = new QueueEvents(name, { connection: getConnectionOptions() });

    // Ensure we always handle error events so they don't crash the process or
    // surface as unhandled errors in tests when connections are closed as part
    // of normal shutdown.
    events.on('error', (error: Error & { context?: Error }) => {
      // Suppress expected "Connection is closed" errors during shutdown
      // BullMQ may wrap errors as "Unhandled error. (Error: Connection is closed...)"
      // and may put the actual error in the context property
      if (isConnectionClosedError(error)) {
        logger.debug(
          { queueName: name },
          'Queue events connection closed (expected during shutdown)'
        );
        return;
      }
      logger.error({ queueName: name, error }, 'Queue events error');
    });

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

    queueEvents.set(name, events);
  }

  queues.set(name, queue);

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
    concurrency: options?.concurrency ?? DEFAULT_WORKER_CONCURRENCY,
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
        originalData: job.data,
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

  const results = await Promise.all(
    Array.from(queues.keys()).map(async (queueName) => {
      const queueMetrics = await getQueueMetrics(queueName);
      return [queueName, queueMetrics] as const;
    })
  );

  for (const [queueName, queueMetrics] of results) {
    metrics[queueName] = queueMetrics;
  }

  return metrics as Record<QueueName, Awaited<ReturnType<typeof getQueueMetrics>>>;
};

/**
 * Close all queues and workers gracefully
 */
export const closeQueues = async (): Promise<void> => {
  logger.info('Closing BullMQ queues and workers...');

  // Close all workers first
  const workerClosePromises = Array.from(workers.values()).map(async (worker) => {
    try {
      // Remove all event listeners to prevent errors during shutdown
      worker.removeAllListeners();
      await worker.close();
    } catch (error) {
      // Ignore errors during shutdown as they're expected when connections are closing
      // Only log if it's not a connection closed error
      if (error instanceof Error && !error.message.includes('Connection is closed')) {
        logger.error({ error }, 'Error closing worker');
      }
    }
  });

  await Promise.all(workerClosePromises);
  workers.clear();

  // Close all queue events - keep error handlers attached during and after close
  const eventsClosePromises = Array.from(queueEvents.entries()).map(async ([queueName, events]) => {
    try {
      // Close while error handler is still active; do not remove listeners to avoid
      // emitting unhandled 'error' events after close resolves.
      await events.close();
    } catch (error) {
      // Ignore connection closed errors during shutdown as they're expected
      if (error instanceof Error && !error.message.includes('Connection is closed')) {
        logger.error({ queueName, error }, 'Error closing queue events');
      }
    }
  });

  await Promise.all(eventsClosePromises);
  queueEvents.clear();

  // Close all queues
  const queueClosePromises = Array.from(queues.values()).map(async (queue) => {
    try {
      await queue.close();
    } catch (error) {
      // Ignore connection closed errors during shutdown
      if (error instanceof Error && !error.message.includes('Connection is closed')) {
        logger.error({ error }, 'Error closing queue');
      }
    }
  });

  await Promise.all(queueClosePromises);
  queues.clear();

  // Small delay to allow connections to fully close
  // eslint-disable-next-line promise/avoid-new -- setTimeout requires Promise wrapper
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, QUEUE_CLOSE_DELAY_MS);
  });

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

    const results = await Promise.all(
      Array.from(queues.entries()).map(async ([name, queue]) => {
        const [metrics, client] = await Promise.all([getQueueMetrics(name), queue.client]);
        return [name, { status: client.status, metrics }] as const;
      })
    );

    for (const [name, data] of results) {
      queueStatuses[name] = data;
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
