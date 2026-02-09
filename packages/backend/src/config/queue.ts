import { Queue } from 'bullmq';
import type Redis from 'ioredis';

export const QUEUE_NAMES = {
  TASK_ASSIGNMENT: 'task-assignment',
  HASH_IMPORT: 'hash-import',
} as const;

export function createQueues(connection: Redis): Record<string, Queue> {
  return {
    [QUEUE_NAMES.TASK_ASSIGNMENT]: new Queue(QUEUE_NAMES.TASK_ASSIGNMENT, { connection }),
    [QUEUE_NAMES.HASH_IMPORT]: new Queue(QUEUE_NAMES.HASH_IMPORT, { connection }),
  };
}
