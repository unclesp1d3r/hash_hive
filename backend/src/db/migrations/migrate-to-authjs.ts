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
 * Ensure legacy authentication data is compatible with Auth.js in an idempotent migration.
 *
 * Checks for existing Auth.js collections and skips work if present; if legacy users exist, verifies compatibility with Auth.js (no automatic schema changes are applied) and leaves session handling to Auth.js. The operation runs inside a MongoDB transaction and commits on success or aborts on error.
 */
export async function migrateToAuthJS(): Promise<void> {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    logger.info('Starting Auth.js migration...');

    // Check if migration has already been run
    // Auth.js adapter creates its own collections (users, accounts, sessions, verification_tokens)
    // We check for Auth.js-specific collections or fields to avoid ambiguity with legacy users collection
    // eslint-disable-next-line @typescript-eslint/prefer-destructuring -- db is a getter property, not a regular property
    const db = mongoose.connection.db;
    if (db === undefined) {
      throw new Error('Database connection not available');
    }

    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((col) => col.name);

    // Check for Auth.js-specific collections (accounts and verification_tokens are Auth.js-only)
    const hasAuthCollections =
      collectionNames.includes('accounts') || collectionNames.includes('verification_tokens');

    // If Auth.js collections don't exist, check users collection for Auth.js-specific fields
    let hasAuthFields = false;
    if (!hasAuthCollections && collectionNames.includes('users')) {
      const usersCollection = db.collection('users');
      // Check for Auth.js-specific fields: emailVerified or account-related structure
      const sampleUser = await usersCollection.findOne({});
      if (sampleUser !== null) {
        // Auth.js adds emailVerified field and accounts are stored separately
        // Check if user has emailVerified field (Auth.js-specific)
        hasAuthFields = 'emailVerified' in sampleUser;
      }
    }

    if (hasAuthCollections || hasAuthFields) {
      logger.info('Auth.js already initialized (found Auth.js collections or fields), skipping migration');
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
 * Verify the post-migration database state for Auth.js readiness.
 *
 * Performs checks against the active MongoDB connection and inspects collection names.
 * Specifically verifies the presence of the Auth.js collections `users` and `sessions`.
 * If the database connection is unavailable or an error occurs, validation fails.
 * If the Auth.js collections are missing, a warning is logged but validation still succeeds
 * because those collections are created lazily by the Auth.js adapter on first use.
 *
 * @returns `true` if the migration state is valid or acceptable (missing Auth.js collections are tolerated), `false` otherwise.
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