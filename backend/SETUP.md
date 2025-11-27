# Backend Setup Guide

This guide covers the setup and initialization requirements for the HashHive backend, with special attention to Auth.js dependencies.

## Prerequisites

- Node.js 20+ and npm 10+
- MongoDB instance (local or remote)
- Redis instance (local or remote)
- Environment variables configured (see `.env.example`)

## Auth.js Dependencies

### @auth/express (Experimental)

**Version**: `^0.12.1` (as of current setup)

**Status**: Experimental / ESM-only

The `@auth/express` package is currently marked as experimental and is ESM-only. This means:

- The API may change in future releases
- Breaking changes are possible between minor versions
- The package requires ESM module resolution

**Maintenance Note**: Monitor [Auth.js release notes](https://authjs.dev/reference/core#releases) for breaking changes. The caret range (`^0.12.1`) in `package.json` will automatically pick up patch and minor updates, but breaking changes may require manual intervention.

### @auth/mongodb-adapter

**Version**: `^3.11.1` (as of current setup)

**Critical Requirement**: The MongoDB adapter requires an **already-connected MongoClient** before it can be initialized.

The adapter does not handle connection logic itself; you must:

1. Create and connect a MongoDB client (or Mongoose connection) first
2. Pass the connected client to the adapter constructor
3. Ensure the connection is established before any Auth.js operations

## Initialization Sequence

The correct initialization order is critical for Auth.js to work properly:

```typescript
// 1. Connect to MongoDB first
await connectDatabase();  // Establishes mongoose connection

// 2. Initialize Auth.js configuration (requires connected MongoDB)
// The auth.config.ts file uses mongoose.connection.getClient()
// which requires mongoose to be connected first
import { authConfig } from './config/auth.config';

// 3. Mount Auth.js routes
app.use('/auth/*', ExpressAuth(authConfig));

// 4. Start the server
app.listen(port);
```

### Current Implementation

In `backend/src/index.ts`, the initialization follows this sequence:

```typescript
if (require.main === module) {
  // Step 1: Connect to MongoDB and Redis
  Promise.all([connectDatabase(), connectRedis()])
    .then(() => {
      // Step 2: Initialize queues (requires Redis)
      initializeQueues();
      
      // Step 3: Start server (Auth.js routes are already mounted,
      // but they won't be used until MongoDB is connected)
      const server = app.listen(config.server.port, () => {
        logger.info('🚀 HashHive Backend started successfully');
      });
      
      setupGracefulShutdown(server);
    })
    .catch((error) => {
      logger.fatal({ error }, 'Failed to start server');
      process.exit(1);
    });
}
```

**Note**: Auth.js routes are mounted at module load time, but the MongoDB adapter requires the connection to be established before any requests are processed. The `connectDatabase()` call ensures this happens before the server starts accepting requests.

### MongoDB Adapter Initialization

In `backend/src/config/auth.config.ts`, the adapter is initialized as:

```typescript
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import { mongoose } from '../db';

export const authConfig: AuthConfig = {
  // mongoose.connection.getClient() requires mongoose to be connected
  adapter: MongoDBAdapter(mongoose.connection.getClient() as any) as Adapter,
  // ... rest of config
};
```

**Important**: `mongoose.connection.getClient()` will throw an error if called before `mongoose.connect()` completes. This is why the connection must be established before the server starts.

## Environment Variables

Required environment variables for Auth.js:

```env
# Auth.js configuration
AUTH_SECRET=your-secret-key-minimum-32-characters-long
AUTH_URL=http://localhost:3001

# MongoDB connection (required before Auth.js can initialize)
MONGODB_URI=mongodb://localhost:27017/hashhive

# Redis connection (for queues, not directly used by Auth.js)
REDIS_HOST=localhost
REDIS_PORT=6379
```

See `backend/.env.example` for the complete list of required variables.

## Troubleshooting

### "MongoClient must be connected" Error

This error occurs if the MongoDB adapter is initialized before the connection is established.

**Solution**: Ensure `connectDatabase()` completes before the server starts accepting requests. Check that the initialization sequence in `backend/src/index.ts` is correct.

### Auth.js Routes Not Working

If Auth.js routes return errors:

1. Verify MongoDB is connected: Check logs for "MongoDB connected successfully"
2. Verify `AUTH_SECRET` is set and at least 32 characters
3. Verify `AUTH_URL` matches your backend URL
4. Check that the adapter was initialized with a connected client

### Experimental Package Warnings

If you see warnings about `@auth/express` being experimental:

- This is expected behavior
- Monitor Auth.js release notes for updates
- Consider pinning to a specific version if stability is critical
- Test thoroughly after updating the package

## References

- [Auth.js Documentation](https://authjs.dev/)
- [@auth/express Documentation](https://authjs.dev/getting-started/installation?framework=express)
- [@auth/mongodb-adapter Documentation](https://authjs.dev/reference/adapter/mongodb)
- [Auth.js Release Notes](https://authjs.dev/reference/core#releases)
- Backend authentication implementation: `docs/authentication-implementation.md`
- Migration guide: `docs/authjs-migration-guide.md`

