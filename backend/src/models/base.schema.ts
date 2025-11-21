/* eslint-disable @typescript-eslint/no-magic-numbers -- Mongoose index directions and defaults rely on conventional numeric values (1, -1, 0, etc.) */
import { Schema } from 'mongoose';
import type { Document, Query } from 'mongoose';

/**
 * Base document interface with timestamps
 */
export interface BaseDocument extends Document {
  created_at: Date;
  updated_at: Date;
}

/**
 * Soft delete document interface
 */
export interface SoftDeleteDocument extends BaseDocument {
  deleted_at?: Date | null;
  is_deleted: boolean;
}

/**
 * Base schema options with timestamps
 */
export const baseSchemaOptions: Record<string, unknown> = {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  // Return virtuals in JSON
  toJSON: {
    virtuals: true,
    transform: (_doc: unknown, ret: Record<string, unknown>) => {
      // Remove MongoDB internal fields from JSON output
      // eslint-disable-next-line @typescript-eslint/naming-convention -- Mongoose reserves __v for internal versioning
      const { __v, ...rest } = ret;
      return rest;
    },
  },
  toObject: {
    virtuals: true,
  },
};

/**
 * Add soft delete functionality to a schema
 * @param schema - Mongoose schema to add soft delete to
 */
export function addSoftDelete<T extends Document>(schema: Schema<T>): void {
  // Add soft delete fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-type-assertion -- Mongoose schema mutation relies on runtime APIs
  (schema as any).add({
    deleted_at: {
      type: Date,
      default: null,
      index: true,
    },
    is_deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  });

  // Add soft delete method
  // eslint-disable-next-line no-param-reassign -- Mongoose plugin pattern mutates schema methods
  (schema.methods as Record<string, unknown>)['softDelete'] = async function (
    this: SoftDeleteDocument
  ) {
    this.deleted_at = new Date();
    this.is_deleted = true;
    return await this.save();
  };

  // Add restore method
  // eslint-disable-next-line no-param-reassign -- Mongoose plugin pattern mutates schema methods
  (schema.methods as Record<string, unknown>)['restore'] = async function (
    this: SoftDeleteDocument
  ) {
    this.set('deleted_at', undefined);
    this.is_deleted = false;
    return await this.save();
  };

  // Add query helpers to exclude soft-deleted documents by default
  // eslint-disable-next-line no-param-reassign -- Mongoose plugin pattern augments query helpers
  (schema.query as Record<string, unknown>)['notDeleted'] = function <ResultType, DocType>(
    this: Query<ResultType, DocType>
  ) {
    // Explicitly exclude deleted documents
    const currentOptions = this.getOptions() as Record<string, unknown>;
    void this.setOptions({ ...currentOptions, includeDeleted: false });
    return this.where({ is_deleted: false });
  };

  // eslint-disable-next-line no-param-reassign -- Mongoose plugin pattern augments query helpers
  (schema.query as Record<string, unknown>)['onlyDeleted'] = function <ResultType, DocType>(
    this: Query<ResultType, DocType>
  ) {
    // Include only soft-deleted documents and prevent the default middleware from overriding
    const currentOptions = this.getOptions() as Record<string, unknown>;
    void this.setOptions({ ...currentOptions, includeDeleted: true });
    return this.where({ is_deleted: true });
  };

  // eslint-disable-next-line no-param-reassign -- Mongoose plugin pattern augments query helpers
  (schema.query as Record<string, unknown>)['withDeleted'] = function <ResultType, DocType>(
    this: Query<ResultType, DocType>
  ) {
    // Return all documents regardless of soft-delete status
    const currentOptions = this.getOptions() as Record<string, unknown>;
    void this.setOptions({ ...currentOptions, includeDeleted: true });
    return this;
  };

  // Modify default find queries to exclude soft-deleted documents
  const excludeDeletedMiddleware = function <ResultType, DocType>(
    this: Query<ResultType, DocType>,
    next: () => void
  ): void {
    // Only apply if not explicitly requesting deleted documents
    const options = this.getOptions() as Record<string, unknown>;
    if (options['includeDeleted'] !== true) {
      void this.where({ is_deleted: false });
    }
    next();
  };

  schema.pre('find', excludeDeletedMiddleware);
  schema.pre('findOne', excludeDeletedMiddleware);
  schema.pre('findOneAndUpdate', excludeDeletedMiddleware);
  schema.pre('countDocuments', excludeDeletedMiddleware);
}

/**
 * Add common indexes to a schema
 * @param schema - Mongoose schema to add indexes to
 * @param additionalIndexes - Additional indexes to create
 */
export function addCommonIndexes<T extends Document>(
  schema: Schema<T>,
  additionalIndexes?: Array<{ fields: Record<string, 1 | -1>; options?: Record<string, unknown> }>
): void {
  const DESCENDING = -1 as const;

  // Index on created_at for sorting
  schema.index({ created_at: DESCENDING });

  // Index on updated_at for sorting
  schema.index({ updated_at: DESCENDING });

  // Add any additional indexes
  if (additionalIndexes !== undefined) {
    additionalIndexes.forEach(({ fields, options }) => {
      schema.index(fields, options);
    });
  }
}

/**
 * Create a base schema with timestamps and optional soft delete
 * @param definition - Schema definition
 * @param options - Schema options
 * @param enableSoftDelete - Enable soft delete functionality
 * @param indexes - Additional indexes to create
 */
export function createBaseSchema<T extends Document>(
  definition: Record<string, unknown>,
  options: Record<string, unknown> = {},
  enableSoftDelete = false,
  indexes?: Array<{ fields: Record<string, 1 | -1>; options?: Record<string, unknown> }>
): Schema<T> {
  // Merge base options with custom options
  const schemaOptions: Record<string, unknown> = {
    ...baseSchemaOptions,
    ...options,
  };

  const schema = new Schema<T>(definition, schemaOptions);

  // Add soft delete if enabled
  if (enableSoftDelete) {
    addSoftDelete(schema);
  }

  // Add common indexes
  addCommonIndexes(schema, indexes);

  return schema;
}

/**
 * Type guard to check if a document has soft delete functionality
 */
export function isSoftDeleteDocument(doc: unknown): doc is SoftDeleteDocument {
  return (
    doc !== null &&
    doc !== undefined &&
    typeof doc === 'object' &&
    'is_deleted' in doc &&
    typeof doc.is_deleted === 'boolean'
  );
}

/**
 * Extend Mongoose Query type with soft delete helpers
 */
declare module 'mongoose' {
  interface Query<ResultType, DocType> {
    notDeleted: () => Query<ResultType, DocType>;
    onlyDeleted: () => Query<ResultType, DocType>;
    withDeleted: () => Query<ResultType, DocType>;
  }

  interface Document {
    softDelete?: () => Promise<this>;
    restore?: () => Promise<this>;
  }
}
