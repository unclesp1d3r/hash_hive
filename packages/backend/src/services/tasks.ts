import { agents, attacks, campaigns, hashItems, tasks } from '@hashhive/shared';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { emitCrackResult, emitTaskUpdate } from './events.js';

// ─── Task Generation ────────────────────────────────────────────────

const DEFAULT_CHUNK_SIZE = 10_000_000; // 10M keyspace units per task

/**
 * Generates tasks for an attack by partitioning its keyspace into chunks.
 * Each chunk becomes a task that can be assigned to an agent.
 */
export async function generateTasksForAttack(
  attackId: number,
  opts: { chunkSize?: number | undefined } = {}
) {
  const [attack] = await db.select().from(attacks).where(eq(attacks.id, attackId)).limit(1);
  if (!attack) {
    return { error: 'Attack not found' };
  }

  const totalKeyspace = Number.parseInt(attack.keyspace ?? '0', 10);
  if (totalKeyspace <= 0) {
    // For attacks without a pre-calculated keyspace, create a single task
    const [task] = await db
      .insert(tasks)
      .values({
        attackId: attack.id,
        campaignId: attack.campaignId,
        status: 'pending',
        workRange: { start: 0, end: 0, total: 0 },
      })
      .returning();

    return { tasks: [task], count: 1 };
  }

  const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunks: Array<{ start: number; end: number; total: number }> = [];

  for (let start = 0; start < totalKeyspace; start += chunkSize) {
    const end = Math.min(start + chunkSize, totalKeyspace);
    chunks.push({ start, end, total: end - start });
  }

  const createdTasks = await db
    .insert(tasks)
    .values(
      chunks.map((range) => ({
        attackId: attack.id,
        campaignId: attack.campaignId,
        status: 'pending' as const,
        workRange: range,
      }))
    )
    .returning();

  return { tasks: createdTasks, count: createdTasks.length };
}

// ─── Task Assignment ────────────────────────────────────────────────

/**
 * Assigns the next available pending task to an agent.
 * Uses SELECT ... FOR UPDATE SKIP LOCKED for safe concurrent assignment.
 */
export async function assignNextTask(agentId: number) {
  // Verify agent exists and is online
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  if (!agent || agent.status !== 'online') {
    return null;
  }

  // Get the agent's project to scope task assignment
  const projectId = agent.projectId;

  // Find and claim a pending task atomically using a transaction
  const result = await db.transaction(async (tx) => {
    // Find pending task for campaigns in this agent's project
    const [pendingTask] = await tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.status, 'pending'), isNull(tasks.agentId)))
      .innerJoin(campaigns, eq(tasks.campaignId, campaigns.id))
      .orderBy(campaigns.priority, tasks.id)
      .limit(1);

    if (!pendingTask) {
      return null;
    }

    // Check project scope
    if (pendingTask.campaigns.projectId !== projectId) {
      return null;
    }

    // Claim the task
    const [assigned] = await tx
      .update(tasks)
      .set({
        agentId,
        status: 'assigned',
        assignedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, pendingTask.tasks.id), eq(tasks.status, 'pending')))
      .returning();

    return assigned ?? null;
  });

  return result;
}

// ─── Task Progress & Results ────────────────────────────────────────

export async function updateTaskProgress(
  taskId: number,
  agentId: number,
  data: {
    status: string;
    progress?:
      | {
          keyspaceProgress?: number | undefined;
          speed?: number | undefined;
          temperature?: number | undefined;
        }
      | undefined;
    results?: Array<{ hashValue: string; plaintext: string }> | undefined;
  }
) {
  // Verify the task belongs to this agent
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.agentId, agentId)))
    .limit(1);

  if (!task) {
    return { error: 'Task not found or not assigned to this agent' };
  }

  const updates: Record<string, unknown> = {
    status: data.status,
    updatedAt: new Date(),
  };

  if (data.progress) {
    updates['progress'] = data.progress;
  }

  if (data.status === 'running' && !task.startedAt) {
    updates['startedAt'] = new Date();
  }

  if (data.status === 'completed' || data.status === 'exhausted') {
    updates['completedAt'] = new Date();
  }

  const [updated] = await db.update(tasks).set(updates).where(eq(tasks.id, taskId)).returning();

  // If results were submitted, insert them as hash items
  if (data.results && data.results.length > 0) {
    // Get the attack to find the hash list
    const [attack] = await db.select().from(attacks).where(eq(attacks.id, task.attackId)).limit(1);

    if (attack) {
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, attack.campaignId))
        .limit(1);

      if (campaign) {
        await db.insert(hashItems).values(
          data.results.map((r) => ({
            hashListId: campaign.hashListId,
            hashValue: r.hashValue,
            plaintext: r.plaintext,
            crackedAt: new Date(),
          }))
        );

        emitCrackResult(campaign.projectId, campaign.hashListId, data.results.length);
      }
    }
  }

  // Emit task update — derive projectId from the campaign
  if (updated) {
    const [campaign] = await db
      .select({ projectId: campaigns.projectId })
      .from(campaigns)
      .where(eq(campaigns.id, task.campaignId))
      .limit(1);

    if (campaign) {
      emitTaskUpdate(campaign.projectId, taskId, data.status, data.progress);
    }
  }

  return { task: updated ?? null };
}

// ─── Task Retry & Failure Handling ──────────────────────────────────

const MAX_RETRIES = 3;

export async function handleTaskFailure(taskId: number, reason: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) {
    return { error: 'Task not found' };
  }

  const resultStats = (task.resultStats as Record<string, unknown>) ?? {};
  const retryCount = (resultStats['retryCount'] as number) ?? 0;

  // Derive projectId from the campaign for event emission
  const [campaign] = await db
    .select({ projectId: campaigns.projectId })
    .from(campaigns)
    .where(eq(campaigns.id, task.campaignId))
    .limit(1);

  if (retryCount < MAX_RETRIES) {
    // Retry: reset task to pending with incremented retry count
    const [updated] = await db
      .update(tasks)
      .set({
        status: 'pending',
        agentId: null,
        assignedAt: null,
        startedAt: null,
        failureReason: reason,
        resultStats: { ...resultStats, retryCount: retryCount + 1, lastFailure: reason },
        updatedAt: new Date(),
      })
      .returning();

    if (updated && campaign) {
      emitTaskUpdate(campaign.projectId, taskId, 'pending');
    }

    return { task: updated, retried: true };
  }

  // Max retries exceeded — mark as failed permanently
  const [updated] = await db
    .update(tasks)
    .set({
      status: 'failed',
      failureReason: reason,
      completedAt: new Date(),
      resultStats: { ...resultStats, retryCount, lastFailure: reason },
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId))
    .returning();

  if (updated && campaign) {
    emitTaskUpdate(campaign.projectId, taskId, 'failed');
  }

  return { task: updated, retried: false };
}

/**
 * Reassigns tasks from agents that have gone offline.
 * Called periodically by a background job.
 */
export async function reassignStaleTasks(staleThresholdMs = 5 * 60 * 1000) {
  const threshold = new Date(Date.now() - staleThresholdMs);

  // Find tasks assigned to agents that haven't checked in
  const staleTasks = await db
    .select({ taskId: tasks.id, agentId: tasks.agentId })
    .from(tasks)
    .innerJoin(agents, eq(tasks.agentId, agents.id))
    .where(and(eq(tasks.status, 'assigned'), sql`${agents.lastSeenAt} < ${threshold}`));

  let reassigned = 0;
  for (const staleTask of staleTasks) {
    await db
      .update(tasks)
      .set({
        status: 'pending',
        agentId: null,
        assignedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, staleTask.taskId));
    reassigned++;
  }

  return { reassigned };
}

// ─── Task Queries ───────────────────────────────────────────────────

export async function getTaskById(id: number) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return task ?? null;
}

export async function listTasks(filters: {
  campaignId?: number | undefined;
  attackId?: number | undefined;
  agentId?: number | undefined;
  status?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}) {
  let query = db.select().from(tasks).$dynamic();

  const conditions = [];
  if (filters.campaignId) {
    conditions.push(eq(tasks.campaignId, filters.campaignId));
  }
  if (filters.attackId) {
    conditions.push(eq(tasks.attackId, filters.attackId));
  }
  if (filters.agentId) {
    conditions.push(eq(tasks.agentId, filters.agentId));
  }
  if (filters.status) {
    conditions.push(eq(tasks.status, filters.status));
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const [results, countResult] = await Promise.all([
    query.limit(limit).offset(offset).orderBy(desc(tasks.createdAt)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined),
  ]);

  return {
    tasks: results,
    total: Number(countResult[0]?.count ?? 0),
    limit,
    offset,
  };
}
