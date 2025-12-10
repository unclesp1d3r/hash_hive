# Services Layer

This directory contains the business logic layer for HashHive. Services encapsulate domain logic and coordinate between models, external systems, and other services.

## Available Services

### StorageService

The `StorageService` provides an abstraction layer for S3-compatible object storage operations. It supports both MinIO (for development) and AWS S3 (for production).

**Features:**

- File upload (Buffer, string, or stream)
- File download with streaming
- File deletion
- Metadata retrieval
- Presigned URL generation for secure downloads
- Automatic bucket creation and initialization
- Comprehensive error handling and logging

**Usage:**

```typescript
import { storageService } from './services';

// Upload a file
const key = await storageService.upload({
  key: 'projects/123/hash-lists/list.txt',
  body: Buffer.from('hash1\nhash2\nhash3'),
  contentType: 'text/plain',
  metadata: {
    'project-id': '123',
    'resource-type': 'hash-list',
  },
});

// Download a file
const result = await storageService.download(key);
for await (const chunk of result.body) {
  // Process chunk
}

// Generate presigned URL (valid for 1 hour by default)
const url = await storageService.getPresignedUrl(key);

// Delete a file
await storageService.delete(key);

// Check if file exists
const exists = await storageService.exists(key);
```

**Configuration:**

The service is configured via environment variables:

- `S3_ENDPOINT` - S3 endpoint URL (e.g., <http://localhost:9000> for MinIO)
- `S3_ACCESS_KEY_ID` - Access key ID
- `S3_SECRET_ACCESS_KEY` - Secret access key
- `S3_BUCKET_NAME` - Bucket name
- `S3_REGION` - AWS region
- `S3_FORCE_PATH_STYLE` - Use path-style URLs (required for MinIO)

**Testing:**

Unit tests: `tests/unit/storage.test.ts`
Integration tests: `tests/integration/storage.test.ts` (uses Testcontainers with MinIO)

**Examples:**

See `src/examples/storage-usage.example.ts` for comprehensive usage examples.

## Service Design Principles

1. **Single Responsibility**: Each service focuses on a specific domain or capability
2. **Dependency Injection**: Services receive dependencies through constructors
3. **Error Handling**: Services throw descriptive errors that can be caught and handled by controllers
4. **Logging**: All services use structured logging via Pino
5. **Type Safety**: Full TypeScript types for all inputs and outputs
6. **Testability**: Services are designed to be easily testable with both unit and integration tests

## Adding New Services

When adding a new service:

1. Create the service file in `src/services/`
2. Export the service class and singleton instance
3. Add exports to `src/services/index.ts`
4. Create unit tests in `tests/unit/`
5. Create integration tests in `tests/integration/` if needed
6. Update this README with service documentation

## Future Services

Based on the design document, the following services will be implemented:

- **AuthService** - User authentication and session management
- **ProjectService** - Project CRUD and membership management
- **AgentService** - Agent registration, heartbeat, and capability tracking
- **CampaignService** - Campaign lifecycle and attack orchestration
- **TaskDistributionService** - Task generation, queueing, and assignment
- **ResourceService** - Resource metadata and file management
- **HashAnalysisService** - Hash type identification and validation
- **EventService** - Real-time event broadcasting
