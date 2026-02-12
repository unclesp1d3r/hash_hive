import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
  hashItems,
  hashLists,
  hashTypes,
  type maskLists,
  type ruleLists,
  type wordLists,
} from '@hashhive/shared';
import { desc, eq, sql } from 'drizzle-orm';
import { env } from '../config/env.js';
import { getPresignedUrl, uploadFile } from '../config/storage.js';
import { db } from '../db/index.js';

// ─── Hash Types ──────────────────────────────────────────────────────

export async function listHashTypes() {
  return db.select().from(hashTypes).orderBy(hashTypes.hashcatMode);
}

export async function getHashTypeById(id: number) {
  const [ht] = await db.select().from(hashTypes).where(eq(hashTypes.id, id)).limit(1);
  return ht ?? null;
}

// ─── Hash Lists ─────────────────────────────────────────────────────

export async function listHashLists(projectId: number) {
  return db
    .select()
    .from(hashLists)
    .where(eq(hashLists.projectId, projectId))
    .orderBy(desc(hashLists.createdAt));
}

export async function getHashListById(id: number) {
  const [hl] = await db.select().from(hashLists).where(eq(hashLists.id, id)).limit(1);
  return hl ?? null;
}

export async function createHashList(data: {
  projectId: number;
  name: string;
  hashTypeId?: number | undefined;
  source?: string | undefined;
}) {
  const [hl] = await db
    .insert(hashLists)
    .values({
      projectId: data.projectId,
      name: data.name,
      hashTypeId: data.hashTypeId ?? null,
      source: data.source ?? 'upload',
      status: 'uploading',
    })
    .returning();

  return hl ?? null;
}

export async function uploadHashListFile(
  hashListId: number,
  file: File
): Promise<{ key: string; size: number }> {
  const hl = await getHashListById(hashListId);
  if (!hl) {
    throw new Error(`Hash list ${hashListId} not found`);
  }

  const ext = extname(file.name);
  const key = `${hl.projectId}/hash-lists/${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadFile(key, buffer, file.type || 'application/octet-stream');

  await db
    .update(hashLists)
    .set({
      fileRef: {
        bucket: env.S3_BUCKET,
        key,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        name: file.name,
        uploadedAt: new Date().toISOString(),
      },
      status: 'uploaded',
      updatedAt: new Date(),
    })
    .where(eq(hashLists.id, hashListId));

  return { key, size: file.size };
}

export async function importHashList(hashListId: number) {
  const hl = await getHashListById(hashListId);
  if (!hl) {
    return null;
  }

  // Check queue availability before marking as processing
  const { getQueueManager } = await import('../queue/context.js');
  const { QUEUE_NAMES } = await import('../config/queue.js');
  const qm = getQueueManager();
  if (!qm) {
    return { error: 'Queue unavailable — cannot process hash list' };
  }
  const health = await qm.getHealth();
  if (health.status === 'disconnected') {
    return { error: 'Queue unavailable — cannot process hash list' };
  }

  // Mark as processing
  await db
    .update(hashLists)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(eq(hashLists.id, hashListId));

  // Enqueue async parsing job into the hash-list-parsing job queue
  const enqueued = await qm.enqueue(QUEUE_NAMES.HASH_LIST_PARSING, {
    hashListId,
    projectId: hl.projectId,
  });

  if (!enqueued) {
    // Revert status since the job was not enqueued
    await db
      .update(hashLists)
      .set({ status: 'uploaded', updatedAt: new Date() })
      .where(eq(hashLists.id, hashListId));
    return { error: 'Failed to enqueue hash list parsing job' };
  }

  return { status: 'processing' as const, queued: true };
}

export async function getHashItems(
  hashListId: number,
  opts: { limit?: number | undefined; offset?: number | undefined }
) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(hashItems)
      .where(eq(hashItems.hashListId, hashListId))
      .limit(limit)
      .offset(offset)
      .orderBy(hashItems.id),
    db
      .select({ count: sql<number>`count(*)` })
      .from(hashItems)
      .where(eq(hashItems.hashListId, hashListId)),
  ]);

  return { items, total: Number(countResult[0]?.count ?? 0), limit, offset };
}

// ─── Generic Resource Lists (wordlists, rulelists, masklists) ───────

export type ResourceTable = typeof wordLists | typeof ruleLists | typeof maskLists;

export async function listResources(table: ResourceTable, projectId: number) {
  return db
    .select()
    .from(table)
    .where(eq(table.projectId, projectId))
    .orderBy(desc(table.createdAt));
}

export async function getResourceById(table: ResourceTable, id: number) {
  const [row] = await db.select().from(table).where(eq(table.id, id)).limit(1);
  return row ?? null;
}

export async function createResource(
  table: ResourceTable,
  data: { projectId: number; name: string }
) {
  const [row] = await db.insert(table).values(data).returning();
  return row ?? null;
}

export async function uploadResourceFile(
  table: ResourceTable,
  resourceId: number,
  prefix: string,
  file: File
) {
  const resource = await getResourceById(table, resourceId);
  if (!resource) {
    throw new Error(`Resource ${resourceId} not found in ${prefix}`);
  }

  const ext = extname(file.name);
  const key = `${resource.projectId}/${prefix}/${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadFile(key, buffer, file.type || 'application/octet-stream');

  await db
    .update(table)
    .set({
      fileRef: {
        bucket: env.S3_BUCKET,
        key,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        name: file.name,
        uploadedAt: new Date().toISOString(),
      },
      fileSize: file.size,
      updatedAt: new Date(),
    })
    .where(eq(table.id, resourceId));

  return { key, size: file.size };
}

// ─── Presigned URLs ─────────────────────────────────────────────────

export async function getResourcePresignedUrl(fileRef: {
  bucket: string;
  key: string;
  name?: string;
}): Promise<string> {
  return getPresignedUrl(fileRef.key, 3600, {
    bucket: fileRef.bucket,
    ...(fileRef.name ? { filename: fileRef.name } : {}),
  });
}
