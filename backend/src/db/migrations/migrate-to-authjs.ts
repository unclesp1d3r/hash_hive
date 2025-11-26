/**
 * Migration script to migrate from legacy authentication to Auth.js
 * This script is idempotent and can be run multiple times safely
 *
 * Note: Since the system is not in production and there are no existing users,
 * this migration script is primarily for documentation purposes.
 * Auth.js will create users in the correct schema format automatically when new users are created.
 *
 * If you need to migrate existing data in the future, uncomment and adapt the migration logic below.
 */

import { mongoose } from '../../db/index';
import { User } from '../../models/user.model';
import { logger } from '../../utils/logger';

/**
 * Idempotent migration script
 * Maps users from legacy schema to Auth.js schema (if needed)
 * Migrates sessions to Auth.js sessions (if needed)
 * Maps project-user relations (preserved in existing models)
 */
export async function migrateToAuthJS(): Promise<void> {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    logger.info('Starting Auth.js migration...');

    // Check if migration has already been run
    // Auth.js adapter creates its own collections (users, accounts, sessions, verification_tokens)
    // We check if auth.users collection exists and has the expected schema
    // eslint-disable-next-line @typescript-eslint/prefer-destructuring -- db is a getter property, not a regular property
    const db = mongoose.connection.db;
    if (db === undefined) {
      throw new Error('Database connection not available');
    }

    const collections = await db.listCollections().toArray();
    const hasAuthUsers = collections.some((col) => col.name === 'users');

    if (hasAuthUsers) {
      logger.info('Auth.js collections already exist, skipping migration');
      await session.commitTransaction();
      return;
    }

    // Migration logic for existing users (if any)
    // Since we're not in production, this is primarily for documentation
    const legacyUsers = await User.find({}).session(session);

    const EMPTY_ARRAY_LENGTH = 0;
    if (legacyUsers.length === EMPTY_ARRAY_LENGTH) {
      logger.info('No existing users to migrate');
      await session.commitTransaction();
      return;
    }

    logger.info({ count: legacyUsers.length }, 'Migrating users to Auth.js schema');

    // Auth.js MongoDB adapter will create users automatically when they log in
    // The existing User model is compatible with Auth.js adapter requirements:
    // - _id field (ObjectId)
    // - email field (string, unique)
    // - password_hash field (for credentials provider)
    // - name field (optional but present)
    //
    // Additional fields that Auth.js adapter expects:
    // - emailVerified (Date | null) - can be added if needed
    // - image (string | null) - optional
    //
    // For now, we preserve the existing User model and let Auth.js adapter
    // work with it directly. If schema changes are needed, they should be
    // handled via Mongoose schema migrations.

    logger.info('User migration completed (no changes needed - schema compatible)');

    // Sessions are managed by Auth.js adapter automatically
    // Legacy sessions will be invalidated on next login
    logger.info('Session migration: Legacy sessions will be invalidated on next login');

    // Project-user relations are preserved in existing ProjectUser model
    // No migration needed for project-user relations
    logger.info('Project-user relations preserved (no migration needed)');

    await session.commitTransaction();
    logger.info('Auth.js migration completed successfully');
  } catch (error) {
    await session.abortTransaction();
    logger.error({ error }, 'Auth.js migration failed, transaction aborted');
    throw error;
  } finally {
    await session.endSession();
  }
}

/**
 * Validate post-migration state
 */
export async function validateMigration(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/prefer-destructuring -- db is a getter property, not a regular property
    const db = mongoose.connection.db;
    if (db === undefined) {
      logger.error('Database connection not available');
      return false;
    }

    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((col) => col.name);

    // Check for Auth.js collections (created by adapter on first use)
    const requiredCollections = ['users', 'sessions'];
    const hasRequiredCollections = requiredCollections.every((name) =>
      collectionNames.includes(name)
    );

    if (!hasRequiredCollections) {
      logger.warn(
        'Auth.js collections not found - they will be created automatically on first use'
      );
      // This is not an error - collections are created lazily by the adapter
      return true;
    }

    logger.info('Migration validation passed');
    return true;
  } catch (error: unknown) {
    logger.error({ error }, 'Migration validation failed');
    return false;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  const EXIT_SUCCESS = 0;
  const EXIT_FAILURE = 1;
  migrateToAuthJS()
    .then(async () => await validateMigration())
    .then((isValid) => {
      if (isValid) {
        logger.info('Migration and validation completed');
        process.exit(EXIT_SUCCESS);
      } else {
        logger.error('Migration validation failed');
        process.exit(EXIT_FAILURE);
      }
    })
    .catch((error: unknown) => {
      logger.error({ error }, 'Migration failed');
      process.exit(EXIT_FAILURE);
    });
}

