import { describe, expect, mock, test } from 'bun:test';
import type Redis from 'ioredis';

// Mock the logger (workers import it)
mock.module('../../../src/config/logger.js', () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
  },
}));

// Mock the DB (services import it)
mock.module('../../../src/db/index.js', () => ({
  db: {},
}));

// Mock the tasks service
const mockReassignStaleTasks = mock(() => Promise.resolve({ reassigned: 0 }));
mock.module('../../../src/services/tasks.js', () => ({
  reassignStaleTasks: mockReassignStaleTasks,
  generateTasksForAttack: mock(),
}));

// Mock BullMQ Worker to capture the processor function
let capturedProcessor: ((job: any) => Promise<any>) | null = null;
mock.module('bullmq', () => ({
  Worker: class MockWorker {
    constructor(_name: string, processor: any) {
      capturedProcessor = processor;
    }
    on() {
      return this;
    }
    close() {
      return Promise.resolve();
    }
  },
  Queue: class MockQueue {
    add() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
    getWaitingCount() {
      return Promise.resolve(0);
    }
    getActiveCount() {
      return Promise.resolve(0);
    }
    getFailedCount() {
      return Promise.resolve(0);
    }
    upsertJobScheduler() {
      return Promise.resolve();
    }
  },
}));

describe('Heartbeat monitor worker', () => {
  test('processor calls reassignStaleTasks', async () => {
    const { createHeartbeatMonitorWorker } = await import(
      '../../../src/queue/workers/heartbeat-monitor.js'
    );

    const fakeConnection = {} as Redis;
    createHeartbeatMonitorWorker(fakeConnection);

    expect(capturedProcessor).toBeDefined();

    const fakeJob = { id: 'test-1', data: { triggeredAt: new Date().toISOString() } };
    const result = await capturedProcessor!(fakeJob);

    expect(mockReassignStaleTasks).toHaveBeenCalled();
    expect(result).toEqual({ reassigned: 0 });
  });

  test('processor returns reassignment count', async () => {
    mockReassignStaleTasks.mockResolvedValueOnce({ reassigned: 3 });

    const fakeJob = { id: 'test-2', data: { triggeredAt: new Date().toISOString() } };
    const result = await capturedProcessor!(fakeJob);

    expect(result).toEqual({ reassigned: 3 });
  });
});
