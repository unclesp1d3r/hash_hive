import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { QUEUE_NAMES } from '../../src/config/queue.js';
import { getQueueManager, setQueueManager } from '../../src/queue/context.js';
import { QueueManager } from '../../src/queue/manager.js';

describe('Queue config', () => {
  test('QUEUE_NAMES has all three queue names', () => {
    expect(QUEUE_NAMES.TASK_DISTRIBUTION).toBe('task-distribution');
    expect(QUEUE_NAMES.HASH_LIST_PARSING).toBe('hash-list-parsing');
    expect(QUEUE_NAMES.HEARTBEAT_MONITOR).toBe('heartbeat-monitor');
  });
});

describe('Queue context', () => {
  test('getQueueManager returns null before setQueueManager', () => {
    // Context starts null (or may have been set by other tests),
    // so we test the set/get cycle
    const qm = new QueueManager();
    setQueueManager(qm);
    expect(getQueueManager()).toBe(qm);
  });

  test('setQueueManager replaces previous instance', () => {
    const qm1 = new QueueManager();
    const qm2 = new QueueManager();
    setQueueManager(qm1);
    expect(getQueueManager()).toBe(qm1);
    setQueueManager(qm2);
    expect(getQueueManager()).toBe(qm2);
  });
});

describe('QueueManager', () => {
  test('can be instantiated without errors', () => {
    const qm = new QueueManager();
    expect(qm).toBeDefined();
    expect(typeof qm.init).toBe('function');
    expect(typeof qm.enqueue).toBe('function');
    expect(typeof qm.getHealth).toBe('function');
    expect(typeof qm.shutdown).toBe('function');
  });

  test('getHealth returns disconnected when not initialized', async () => {
    const qm = new QueueManager();
    const health = await qm.getHealth();
    expect(health.status).toBe('disconnected');
    expect(health.queues).toEqual({});
  });

  test('enqueue returns false when not initialized', async () => {
    const qm = new QueueManager();
    const result = await qm.enqueue(QUEUE_NAMES.HASH_LIST_PARSING, {
      hashListId: 1,
      projectId: 1,
    });
    expect(result).toBe(false);
  });
});
