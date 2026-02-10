export const QUEUE_NAMES = {
  TASK_DISTRIBUTION: 'task-distribution',
  HASH_LIST_PARSING: 'hash-list-parsing',
  HEARTBEAT_MONITOR: 'heartbeat-monitor',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
