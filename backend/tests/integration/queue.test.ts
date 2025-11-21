import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { Job } from 'bullmq';
import {
  initializeQueues,
  createQueue,
  getQueue,
  registerWorker,
  moveToDeadLetterQueue,
  getQueueMetrics,
  getAllQueueMetrics,
  closeQueues,
  checkQueueHealth,
  QUEUE_NAMES,
} from '../../src/config/queue';
import { connectRedis, disconnectRedis } from '../../src/config/redis';

describe('BullMQ Queue Integration Tests', () => {
  let redisContainer: StartedRedisContainer;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(async () => {
    // Save original environment
    originalEnv = { ...process.env };

    // Start Redis container via community module
    redisContainer = await new RedisContainer('redis:7-alpine').start();

    const redisHost = redisContainer.getHost();
    const redisPort = redisContainer.getPort();

    // Update environment for tests
    process.env['REDIS_HOST'] = redisHost;
    process.env['REDIS_PORT'] = redisPort.toString();
    process.env['REDIS_PASSWORD'] = '';

    // Connect to Redis
    await connectRedis();
  }, 60000);

  afterAll(async () => {
    await closeQueues();
    await disconnectRedis();
    await redisContainer.stop();

    // Restore original environment
    process.env = originalEnv;
  }, 30000);

  afterEach(async () => {
    // Clean up all jobs from all queues before closing
    try {
      const taskQueue = getQueue(QUEUE_NAMES.TASKS);
      await taskQueue.obliterate({ force: true });
    } catch {
      // Queue might not exist
    }
    await closeQueues();
  });

  describe('initializeQueues', () => {
    it('should initialize all default queues', async () => {
      await initializeQueues();

      // Verify all queues are created
      expect(() => getQueue(QUEUE_NAMES.TASKS)).not.toThrow();
      expect(() => getQueue(QUEUE_NAMES.HASH_IMPORT)).not.toThrow();
      expect(() => getQueue(QUEUE_NAMES.RESOURCE_PROCESSING)).not.toThrow();
      expect(() => getQueue(QUEUE_NAMES.DEAD_LETTER)).not.toThrow();
    });
  });

  describe('createQueue and getQueue', () => {
    it('should create a new queue', async () => {
      const queue = createQueue(QUEUE_NAMES.TASKS);

      expect(queue).toBeDefined();
      expect(queue.name).toBe(QUEUE_NAMES.TASKS);
    });

    it('should return existing queue if already created', async () => {
      const queue1 = createQueue(QUEUE_NAMES.TASKS);
      const queue2 = createQueue(QUEUE_NAMES.TASKS);

      expect(queue1).toBe(queue2);
    });

    it('should get existing queue', async () => {
      createQueue(QUEUE_NAMES.TASKS);
      const queue = getQueue(QUEUE_NAMES.TASKS);

      expect(queue).toBeDefined();
      expect(queue.name).toBe(QUEUE_NAMES.TASKS);
    });

    it('should throw error when getting non-existent queue', () => {
      expect(() => getQueue(QUEUE_NAMES.TASKS)).toThrow('Queue "tasks" not initialized');
    });
  });

  describe('Queue operations', () => {
    beforeEach(async () => {
      await initializeQueues();
    });

    it('should add and process jobs', async () => {
      const queue = getQueue(QUEUE_NAMES.TASKS);
      const processedJobs: any[] = [];

      // Register worker
      const worker = registerWorker(QUEUE_NAMES.TASKS, async (job: Job) => {
        processedJobs.push(job.data);
        return { success: true };
      });

      // Add job
      await queue.add('test-job', { taskId: '123', data: 'test' });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(processedJobs.length).toBeGreaterThanOrEqual(1);
      expect(processedJobs).toContainEqual({ taskId: '123', data: 'test' });

      await worker.close();
    });

    it.skip('should handle job failures with retry', async () => {
      const queue = getQueue(QUEUE_NAMES.TASKS);
      let attemptCount = 0;
      let jobCompleted = false;

      // Register worker that fails twice then succeeds
      const worker = registerWorker(QUEUE_NAMES.TASKS, async (_job: Job) => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Simulated failure');
        }
        jobCompleted = true;
        return { success: true, attempts: attemptCount };
      });

      // Add job with retry configuration
      await queue.add(
        'retry-job',
        { taskId: '456' },
        {
          attempts: 3,
          backoff: {
            type: 'fixed',
            delay: 50,
          },
        }
      );

      // Wait for job to complete with polling
      const maxWait = 5000;
      const startTime = Date.now();
      while (!jobCompleted && Date.now() - startTime < maxWait) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      expect(attemptCount).toBe(3);
      expect(jobCompleted).toBe(true);

      await worker.close();
    });

    it('should handle concurrent job processing', async () => {
      const queue = getQueue(QUEUE_NAMES.TASKS);
      const processedJobs: string[] = [];
      let completedCount = 0;
      let resolveCompletion: (() => void) | undefined;
      const allJobsCompleted = new Promise<void>((resolve) => {
        resolveCompletion = resolve;
      });

      // Register worker with concurrency
      const worker = registerWorker(
        QUEUE_NAMES.TASKS,
        async (job: Job) => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          processedJobs.push(job.data.id);
          completedCount++;
          if (completedCount === 5 && resolveCompletion) {
            resolveCompletion();
          }
          return { success: true };
        },
        { concurrency: 3 }
      );

      try {
        // Give worker time to be ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Add multiple jobs
        const jobPromises = [];
        for (let i = 0; i < 5; i++) {
          jobPromises.push(queue.add('concurrent-job', { id: `job-${i}` }));
        }
        await Promise.all(jobPromises);

        // Wait for all jobs to complete with timeout
        await Promise.race([
          allJobsCompleted,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout waiting for jobs')), 10000)
          ),
        ]);

        expect(processedJobs).toHaveLength(5);
      } finally {
        await worker.close();
      }
    });
  });

  describe('moveToDeadLetterQueue', () => {
    beforeEach(async () => {
      await initializeQueues();
    });

    it('should move failed job to dead-letter queue', async () => {
      const queue = getQueue(QUEUE_NAMES.TASKS);
      const deadLetterQueue = getQueue(QUEUE_NAMES.DEAD_LETTER);

      // Add a job
      const job = await queue.add('failing-job', { taskId: '789' });

      // Move to dead-letter queue
      await moveToDeadLetterQueue(job, 'Test failure reason');

      // Check dead-letter queue
      const deadLetterJobs = await deadLetterQueue.getJobs(['waiting', 'active', 'completed']);

      expect(deadLetterJobs.length).toBeGreaterThan(0);
      const deadLetterJob = deadLetterJobs[0];
      expect(deadLetterJob).toBeDefined();
      expect(deadLetterJob!.data.originalQueue).toBe(QUEUE_NAMES.TASKS);
      expect(deadLetterJob!.data.originalJobId).toBe(job.id);
      expect(deadLetterJob!.data.failedReason).toBe('Test failure reason');
    });
  });

  describe('getQueueMetrics', () => {
    beforeEach(async () => {
      await initializeQueues();
    });

    it('should return queue metrics', async () => {
      const queue = getQueue(QUEUE_NAMES.TASKS);

      // Add some jobs
      await queue.add('job1', { data: 'test1' });
      await queue.add('job2', { data: 'test2' });

      const metrics = await getQueueMetrics(QUEUE_NAMES.TASKS);

      expect(metrics).toHaveProperty('waiting');
      expect(metrics).toHaveProperty('active');
      expect(metrics).toHaveProperty('completed');
      expect(metrics).toHaveProperty('failed');
      expect(metrics).toHaveProperty('delayed');
      expect(metrics.waiting).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getAllQueueMetrics', () => {
    beforeEach(async () => {
      await initializeQueues();
    });

    it('should return metrics for all queues', async () => {
      const allMetrics = await getAllQueueMetrics();

      expect(allMetrics).toHaveProperty(QUEUE_NAMES.TASKS);
      expect(allMetrics).toHaveProperty(QUEUE_NAMES.HASH_IMPORT);
      expect(allMetrics).toHaveProperty(QUEUE_NAMES.RESOURCE_PROCESSING);
      expect(allMetrics).toHaveProperty(QUEUE_NAMES.DEAD_LETTER);

      Object.values(allMetrics).forEach((metrics) => {
        expect(metrics).toHaveProperty('waiting');
        expect(metrics).toHaveProperty('active');
        expect(metrics).toHaveProperty('completed');
        expect(metrics).toHaveProperty('failed');
      });
    });
  });

  describe('checkQueueHealth', () => {
    beforeEach(async () => {
      await initializeQueues();
    });

    it('should return healthy status when queues are operational', async () => {
      const health = await checkQueueHealth();

      expect(health.status).toBe('healthy');
      expect(health.queues).toBeDefined();
      expect(Object.keys(health.queues!)).toHaveLength(4);
    });

    it('should include queue metrics in health check', async () => {
      const health = await checkQueueHealth();

      expect(health.queues).toBeDefined();
      const tasksHealth = health.queues![QUEUE_NAMES.TASKS];
      expect(tasksHealth).toHaveProperty('status');
      expect(tasksHealth).toHaveProperty('metrics');
    });
  });

  describe('closeQueues', () => {
    it('should close all queues gracefully', async () => {
      await initializeQueues();
      await closeQueues();

      // Should throw error when trying to get queue after closing
      expect(() => getQueue(QUEUE_NAMES.TASKS)).toThrow();
    });

    it('should handle closing when no queues exist', async () => {
      await expect(closeQueues()).resolves.not.toThrow();
    });
  });
});
