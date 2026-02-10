# Resource Management API

## Overview

Implement resource upload endpoints with async hash list parsing, idempotency guarantees, and hash type detection to support the resource management UI.

## Scope

**In Scope:**
- Implement resource upload endpoints (hash lists, wordlists, rulelists, masklists)
- Add async hash list parsing via BullMQ with idempotency (unique constraint on `hash_list_id`, `hash_value`)
- Implement bulk insert for `hash_items` (batches of 1000 using Drizzle)
- Add resource CRUD endpoints with project scoping
- Implement hash type detection endpoint using name-that-hash library
- Add resource statistics calculation (total count, cracked count, crack rate)
- Update `file:packages/backend/src/routes/dashboard/resources.ts` and `file:packages/backend/src/services/resources.ts`

**Out of Scope:**
- Resource UI (handled in frontend ticket)
- Advanced hash analysis (pattern detection, entropy analysis)
- Resource sharing between projects

## Acceptance Criteria

1. **Resource Upload**
   - `POST /api/v1/dashboard/resources/hash-lists` accepts multipart file upload
   - Uploads file to MinIO with unique object key
   - Creates `hash_lists` record with `status = uploading` and `file_ref`
   - Enqueues `jobs:hash-list-parsing` job to BullMQ
   - Returns hash list record immediately (async parsing)

2. **Async Hash List Parsing**
   - BullMQ worker downloads file from MinIO
   - Parses hashes line-by-line (supports common formats: `hash`, `hash:salt`, `username:hash`)
   - Bulk inserts `hash_items` in batches of 1000 using Drizzle batch API
   - Updates `hash_lists.status = ready` and `statistics` on completion
   - Emits `hash_list_ready` event via EventService

3. **Idempotency**
   - Unique constraint on `(hash_list_id, hash_value)` in `hash_items` table
   - Upsert/ignore semantics on duplicate hashes (no error on retry)
   - Job retries safe (won't create duplicate hash_items)

4. **Resource CRUD**
   - `GET /api/v1/dashboard/resources/hash-lists` returns project-scoped hash lists
   - `GET /api/v1/dashboard/resources/hash-lists/:id` returns hash list with statistics
   - `DELETE /api/v1/dashboard/resources/hash-lists/:id` deletes hash list and associated hash_items
   - Similar endpoints for wordlists, rulelists, masklists

5. **Hash Type Detection**
   - `POST /api/v1/dashboard/resources/detect-hash-type` accepts sample hashes
   - Uses name-that-hash library to identify hash type
   - Returns candidates with confidence scores and hashcat modes
   - Maps to `hash_types` table entries

6. **Resource Statistics**
   - `hash_lists.statistics` JSONB field stores:
     - `total_count`: Total hashes in list
     - `cracked_count`: Number of cracked hashes
     - `crack_rate`: Percentage cracked
     - `last_updated`: Timestamp of last statistics update
   - Statistics updated when hashes are cracked

## Technical Notes

**Hash List Parsing Worker:**
```typescript
// BullMQ worker for hash list parsing
async function parseHashList(job: Job) {
  const { hashListId } = job.data;

  // Download file from MinIO
  const stream = await minioClient.getObject(bucket, key);

  // Parse line-by-line
  const batch: HashItem[] = [];
  for await (const line of stream) {
    const hash = parseLine(line); // Extract hash, salt, username
    batch.push({ hashListId, hashValue: hash, ... });

    if (batch.length >= 1000) {
      await db.insert(hashItems).values(batch).onConflictDoNothing();
      batch.length = 0;
    }
  }

  // Insert remaining
  if (batch.length > 0) {
    await db.insert(hashItems).values(batch).onConflictDoNothing();
  }

  // Update statistics
  await updateHashListStatistics(hashListId);
  await db.update(hashLists).set({ status: 'ready' }).where(eq(hashLists.id, hashListId));

  // Emit event
  eventService.emit('hash_list_ready', { hashListId });
}
```

**Unique Constraint Migration:**
```sql
ALTER TABLE hash_items
ADD CONSTRAINT hash_items_hash_list_id_hash_value_unique
UNIQUE (hash_list_id, hash_value);
```

## Dependencies

- `ticket:f4542d0d-b9bd-4e50-b90b-9141e8063a18/T1` (BullMQ Queue Architecture)
- `ticket:f4542d0d-b9bd-4e50-b90b-9141e8063a18/T2` (MinIO Storage)
- `ticket:f4542d0d-b9bd-4e50-b90b-9141e8063a18/T7` (Project Selection & User Auth)

## Spec References

- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/9332598a-b507-42ee-8e71-6a8e43712c16` (Tech Plan → Resource Storage Architecture)
- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/9332598a-b507-42ee-8e71-6a8e43712c16` (Tech Plan → Hash import idempotency decision)
- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/98662419-66d0-40ee-a788-e5aa8c4c4de5` (Core Flows → Flows 6-7: Resource Management & Hash Detection)
