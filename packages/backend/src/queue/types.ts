import type { QUEUE_NAMES } from '../config/queue.js';

// ─── Job Priority ────────────────────────────────────────────────────

export const JOB_PRIORITY = {
  HIGH: 1,
  NORMAL: 5,
  LOW: 10,
} as const;

export type JobPriority = (typeof JOB_PRIORITY)[keyof typeof JOB_PRIORITY];

// ─── Job Payloads ────────────────────────────────────────────────────

export interface HashListParseJob {
  hashListId: number;
  projectId: number;
}

export interface TaskGenerationJob {
  campaignId: number;
  projectId: number;
  attackIds: number[];
  priority: JobPriority;
}

export interface HeartbeatMonitorJob {
  triggeredAt: string;
}

// ─── Job Data Discriminated Union ────────────────────────────────────

export type QueueJobMap = {
  [QUEUE_NAMES.HASH_LIST_PARSING]: HashListParseJob;
  [QUEUE_NAMES.TASK_DISTRIBUTION]: TaskGenerationJob;
  [QUEUE_NAMES.HEARTBEAT_MONITOR]: HeartbeatMonitorJob;
};
