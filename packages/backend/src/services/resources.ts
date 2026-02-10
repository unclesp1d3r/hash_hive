import { hashItems, hashLists, hashTypes, maskLists, ruleLists, wordLists } from '@hashhive/shared';
import { desc, eq, sql } from 'drizzle-orm';
import { uploadFile } from '../config/storage.js';
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
  const key = `hash-lists/${hashListId}/${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadFile(key, buffer, file.type || 'application/octet-stream');

  await db
    .update(hashLists)
    .set({
      fileRef: { bucket: 'hashhive', key, size: file.size, name: file.name },
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

  // Mark as processing
  await db
    .update(hashLists)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(eq(hashLists.id, hashListId));

  // In a real implementation, this would read the file from S3,
  // parse it line-by-line, and insert hash items in batches.
  // For now, mark as ready.
  await db
    .update(hashLists)
    .set({ status: 'ready', updatedAt: new Date() })
    .where(eq(hashLists.id, hashListId));

  return { status: 'ready' };
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

type ResourceTable = typeof wordLists | typeof ruleLists | typeof maskLists;

async function listResources(table: ResourceTable, projectId: number) {
  return db
    .select()
    .from(table)
    .where(eq(table.projectId, projectId))
    .orderBy(desc(table.createdAt));
}

async function getResourceById(table: ResourceTable, id: number) {
  const [row] = await db.select().from(table).where(eq(table.id, id)).limit(1);
  return row ?? null;
}

async function createResource(table: ResourceTable, data: { projectId: number; name: string }) {
  const [row] = await db.insert(table).values(data).returning();
  return row ?? null;
}

async function uploadResourceFile(
  table: ResourceTable,
  resourceId: number,
  prefix: string,
  file: File
) {
  const key = `${prefix}/${resourceId}/${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadFile(key, buffer, file.type || 'application/octet-stream');

  await db
    .update(table)
    .set({
      fileRef: { bucket: 'hashhive', key, size: file.size, name: file.name },
      fileSize: file.size,
      updatedAt: new Date(),
    })
    .where(eq(table.id, resourceId));

  return { key, size: file.size };
}

// Wordlists
export const listWordLists = (projectId: number) => listResources(wordLists, projectId);
export const getWordListById = (id: number) => getResourceById(wordLists, id);
export const createWordList = (data: { projectId: number; name: string }) =>
  createResource(wordLists, data);
export const uploadWordListFile = (id: number, file: File) =>
  uploadResourceFile(wordLists, id, 'wordlists', file);

// Rulelists
export const listRuleLists = (projectId: number) => listResources(ruleLists, projectId);
export const getRuleListById = (id: number) => getResourceById(ruleLists, id);
export const createRuleList = (data: { projectId: number; name: string }) =>
  createResource(ruleLists, data);
export const uploadRuleListFile = (id: number, file: File) =>
  uploadResourceFile(ruleLists, id, 'rulelists', file);

// Masklists
export const listMaskLists = (projectId: number) => listResources(maskLists, projectId);
export const getMaskListById = (id: number) => getResourceById(maskLists, id);
export const createMaskList = (data: { projectId: number; name: string }) =>
  createResource(maskLists, data);
export const uploadMaskListFile = (id: number, file: File) =>
  uploadResourceFile(maskLists, id, 'masklists', file);
