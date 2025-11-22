# Models Directory

This directory contains Mongoose models and schemas for the HashHive backend.

## Base Schema

The `base.schema.ts` file provides utilities for creating consistent Mongoose schemas with common features:

### Features

- **Timestamps**: Automatic `created_at` and `updated_at` fields
- **Soft Delete**: Optional soft delete functionality with `deleted_at` and `is_deleted` fields
- **Common Indexes**: Automatic indexes on timestamp fields
- **Type Safety**: Full TypeScript support with type inference

### Usage Examples

#### Basic Schema with Timestamps

```typescript
import { createBaseSchema, BaseDocument } from './base.schema';
import { model } from 'mongoose';

interface IUser extends BaseDocument {
  email: string;
  name: string;
}

const userSchema = createBaseSchema<IUser>({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
});

export const User = model<IUser>('User', userSchema);
```

#### Schema with Soft Delete

```typescript
import { createBaseSchema, SoftDeleteDocument } from './base.schema';
import { model } from 'mongoose';

interface IProject extends SoftDeleteDocument {
  name: string;
  description: string;
}

const projectSchema = createBaseSchema<IProject>(
  {
    name: { type: String, required: true },
    description: { type: String },
  },
  {}, // Additional schema options
  true // Enable soft delete
);

export const Project = model<IProject>('Project', projectSchema);
```

#### Using Soft Delete Methods

```typescript
// Soft delete a document
const project = await Project.findById(projectId);
await project.softDelete();

// Restore a soft deleted document
await project.restore();

// Query only active (not deleted) documents - this is the default behavior
// Soft-deleted documents are automatically excluded from all queries
const activeProjects = await Project.find();

// Query only deleted documents
const deletedProjects = await Project.find().onlyDeleted();

// Query all documents including deleted
const allProjects = await Project.find().withDeleted();

// Explicitly include deleted documents (alternative syntax)
const allProjectsAlt = await Project.find().setOptions({ includeDeleted: true });
```

**Important:** Soft-deleted documents are automatically excluded from all query operations (`find`, `findOne`, `findOneAndUpdate`, `countDocuments`) via Mongoose pre-hooks. You must explicitly use `.withDeleted()` or `.onlyDeleted()` query helpers if you need to access soft-deleted documents.

#### Schema with Custom Indexes

```typescript
import { createBaseSchema, BaseDocument } from './base.schema';
import { model } from 'mongoose';

interface IAgent extends BaseDocument {
  name: string;
  project_id: string;
  auth_token: string;
  status: string;
}

const agentSchema = createBaseSchema<IAgent>(
  {
    name: { type: String, required: true },
    project_id: { type: String, required: true },
    auth_token: { type: String, required: true },
    status: { type: String, required: true },
  },
  {}, // Additional schema options
  false, // Soft delete disabled
  [
    // Custom indexes
    { fields: { auth_token: 1 }, options: { unique: true } },
    { fields: { project_id: 1, status: 1 } },
    { fields: { status: 1, created_at: -1 } },
  ]
);

export const Agent = model<IAgent>('Agent', agentSchema);
```

## Database Connection

The `config/database.ts` module provides MongoDB connection management:

### Features

- **Retry Logic**: Automatic retry on connection failure
- **Connection Pooling**: Configurable connection pool size
- **Event Handlers**: Logging for connection events
- **Graceful Shutdown**: Proper cleanup on process termination

### Usage

```typescript
import { connectDatabase, disconnectDatabase, isMongoConnected } from '../config/database';

// Connect to MongoDB
await connectDatabase();

// Check connection status
if (isMongoConnected()) {
  console.log('Database is connected');
}

// Disconnect gracefully
await disconnectDatabase();
```

### Configuration

Database connection is configured via environment variables:

- `MONGODB_URI`: MongoDB connection string (default: `mongodb://localhost:27017/hashhive`)
- `MONGODB_MAX_POOL_SIZE`: Maximum connection pool size (default: `10`)

## Model Conventions

When creating new models, follow these conventions:

1. **File Naming**: Use kebab-case for file names (e.g., `user.model.ts`, `project-user.model.ts`)
2. **Interface Naming**: Use PascalCase with `I` prefix (e.g., `IUser`, `IProject`)
3. **Model Naming**: Use PascalCase matching the collection name (e.g., `User`, `Project`)
4. **Collection Naming**: Use snake_case for MongoDB collections (e.g., `users`, `project_users`)
5. **Timestamps**: Always use base schema for automatic timestamps
6. **Soft Delete**: Enable for user-facing data that should be recoverable
7. **Indexes**: Add indexes for common query patterns
8. **Exports**: Export models from `index.ts` for centralized imports

## Testing

Models should be tested with:

1. **Unit Tests**: Schema validation, methods, virtuals
2. **Integration Tests**: Database operations, queries, transactions

See `tests/unit/base-schema.test.ts` for examples.
