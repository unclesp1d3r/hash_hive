# MinIO Storage & File Management

## Overview

Configure MinIO S3-compatible storage for binary artifacts (hash lists, wordlists, rulelists, masklists) with env-driven bucket configuration following 12-factor app principles.

## Scope

**In Scope:**
- Configure MinIO client with env-driven bucket names (12-factor: `S3_BUCKET` from env/config)
- Implement file upload to MinIO with `file_ref` JSONB structure
- Generate presigned URLs for agent downloads (1-hour expiration)
- Add MinIO health checks to `/health` endpoint
- Update `file_ref` schema to use env/config bucket name consistently
- Update storage service in `file:packages/backend/src/services/resources.ts`

**Out of Scope:**
- Hash list parsing logic (handled in separate ticket)
- Resource management UI (handled in frontend ticket)
- File versioning or backup strategies

## Acceptance Criteria

1. **MinIO Client Configuration**
   - MinIO client configured with endpoint, access key, secret key from environment variables
   - Bucket name sourced from `S3_BUCKET` environment variable
   - Client supports both local MinIO and AWS S3 (same API)

2. **File Upload**
   - Files uploaded to MinIO with unique object keys (e.g., `{project_id}/{resource_type}/{uuid}.{ext}`)
   - `file_ref` JSONB field stores: `{ bucket, key, contentType, size, uploadedAt }`
   - Bucket name in `file_ref` matches env/config value (no hard-coded `'hashhive'`)
   - Upload returns object metadata (bucket, key, size, content type)

3. **Presigned URLs**
   - Generate presigned URLs for agent downloads with 1-hour expiration
   - URLs work for both MinIO and S3 (same API)
   - URLs include appropriate content-disposition headers for downloads

4. **Health Checks**
   - MinIO connectivity check added to `/health` endpoint
   - Health check verifies bucket exists and is accessible
   - Health check reports MinIO status (connected/disconnected)

5. **12-Factor Compliance**
   - All MinIO configuration sourced from environment variables
   - No hard-coded bucket names in code
   - Configuration validated on startup (fail fast if misconfigured)

## Technical Notes

**Current Implementation Issue:**
- `file:packages/backend/src/services/resources.ts` hard-codes `fileRef.bucket = 'hashhive'`
- `file:packages/backend/src/config/storage.ts` uses `env.S3_BUCKET`
- Need to align both to use env-driven bucket name

**File Reference Structure:**
```typescript
interface FileRef {
  bucket: string;      // From env.S3_BUCKET
  key: string;         // Unique object key
  contentType: string; // MIME type
  size: number;        // File size in bytes
  uploadedAt: string;  // ISO timestamp
}
```

**Presigned URL Generation:**
```typescript
const presignedUrl = await s3Client.presignedGetObject(
  fileRef.bucket,
  fileRef.key,
  60 * 60 // 1 hour expiration
);
```

## Dependencies

None (foundation layer)

## Spec References

- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/9332598a-b507-42ee-8e71-6a8e43712c16` (Tech Plan → Resource Storage Architecture)
- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/9332598a-b507-42ee-8e71-6a8e43712c16` (Tech Plan → MinIO bucket metadata decision)
