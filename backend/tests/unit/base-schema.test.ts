import mongoose, { Schema } from 'mongoose';
import {
  createBaseSchema,
  addCommonIndexes,
  isSoftDeleteDocument,
  type BaseDocument,
  type SoftDeleteDocument,
} from '../../src/models/base.schema';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';

describe('Base Schema', () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  afterEach(async () => {
    // Clean up all collections after each test
    const { db } = mongoose.connection;
    if (db !== undefined) {
      const collections = await db.collections();
      for (const collection of collections) {
        await collection.deleteMany({});
      }
    }
  });

  describe('createBaseSchema', () => {
    it('should create schema with timestamps', () => {
      const schema = createBaseSchema({
        name: { type: String, required: true },
      });

      expect(schema.path('created_at')).toBeDefined();
      expect(schema.path('updated_at')).toBeDefined();
    });

    it('should create schema without soft delete by default', () => {
      const schema = createBaseSchema({
        name: { type: String, required: true },
      });

      expect(schema.path('deleted_at')).toBeUndefined();
      expect(schema.path('is_deleted')).toBeUndefined();
    });

    it('should create schema with soft delete when enabled', () => {
      const schema = createBaseSchema(
        {
          name: { type: String, required: true },
        },
        {},
        true // Enable soft delete
      );

      expect(schema.path('deleted_at')).toBeDefined();
      expect(schema.path('is_deleted')).toBeDefined();
    });

    it('should add common indexes', () => {
      const schema = createBaseSchema({
        name: { type: String, required: true },
      });

      const indexes = schema.indexes();
      const indexFields = indexes.map((idx) => Object.keys(idx[0])[0]);

      expect(indexFields).toContain('created_at');
      expect(indexFields).toContain('updated_at');
    });

    it('should add custom indexes', () => {
      const schema = createBaseSchema(
        {
          email: { type: String, required: true },
        },
        {},
        false,
        [{ fields: { email: 1 }, options: { unique: true } }]
      );

      const indexes = schema.indexes();
      const emailIndex = indexes.find((idx) => 'email' in idx[0]);

      expect(emailIndex).toBeDefined();
      expect(emailIndex?.[1]?.unique).toBe(true);
    });
  });

  describe('Soft Delete Functionality', () => {
    interface TestDoc extends SoftDeleteDocument {
      name: string;
    }

    let TestModel: mongoose.Model<TestDoc>;

    beforeEach(() => {
      const schema = createBaseSchema<TestDoc>(
        {
          name: { type: String, required: true },
        },
        {},
        true // Enable soft delete
      );

      TestModel = mongoose.model<TestDoc>('SoftDeleteTest', schema);
    });

    afterEach(() => {
      mongoose.connection.deleteModel('SoftDeleteTest');
    });

    it('should soft delete a document', async () => {
      const doc = await TestModel.create({ name: 'Test Document' });

      await doc.softDelete!();

      expect(doc.is_deleted).toBe(true);
      expect(doc.deleted_at).toBeInstanceOf(Date);
    });

    it('should restore a soft deleted document', async () => {
      const doc = await TestModel.create({ name: 'Test Document' });
      await doc.softDelete!();

      await doc.restore!();

      expect(doc.is_deleted).toBe(false);
      expect(doc.deleted_at).toBeUndefined();
    });

    it('should exclude soft deleted documents from find queries', async () => {
      await TestModel.create({ name: 'Active Document' });
      const deletedDoc = await TestModel.create({ name: 'Deleted Document' });
      await deletedDoc.softDelete!();

      const results = await TestModel.find().notDeleted();

      expect(results.length).toBe(1);
      expect(results[0]?.name).toBe('Active Document');
    });

    it('should find only deleted documents with onlyDeleted', async () => {
      await TestModel.create({ name: 'Active Document' });
      const deletedDoc = await TestModel.create({ name: 'Deleted Document' });
      await deletedDoc.softDelete!();

      const results = await TestModel.find().onlyDeleted();

      expect(results.length).toBe(1);
      expect(results[0]?.name).toBe('Deleted Document');
    });

    it('should find all documents with withDeleted', async () => {
      await TestModel.create({ name: 'Active Document' });
      const deletedDoc = await TestModel.create({ name: 'Deleted Document' });
      await deletedDoc.softDelete!();

      const results = await TestModel.find().withDeleted();

      expect(results.length).toBe(2);
    });

    it('should exclude soft deleted documents from findOne', async () => {
      const deletedDoc = await TestModel.create({ name: 'Deleted Document' });
      await deletedDoc.softDelete!();

      const result = await TestModel.findOne({ name: 'Deleted Document' }).notDeleted();

      expect(result).toBeNull();
    });

    it('should exclude soft deleted documents from countDocuments', async () => {
      await TestModel.create({ name: 'Active Document' });
      const deletedDoc = await TestModel.create({ name: 'Deleted Document' });
      await deletedDoc.softDelete!();

      const count = await TestModel.countDocuments().notDeleted();

      expect(count).toBe(1);
    });

    it('should include deleted documents when includeDeleted option is set', async () => {
      await TestModel.create({ name: 'Active Document' });
      const deletedDoc = await TestModel.create({ name: 'Deleted Document' });
      await deletedDoc.softDelete!();

      const results = await TestModel.find().setOptions({ includeDeleted: true });

      expect(results.length).toBe(2);
    });
  });

  describe('Timestamps', () => {
    interface TestDoc extends BaseDocument {
      name: string;
    }

    let TestModel: mongoose.Model<TestDoc>;

    beforeEach(() => {
      const schema = createBaseSchema<TestDoc>({
        name: { type: String, required: true },
      });

      TestModel = mongoose.model<TestDoc>('TimestampTest', schema);
    });

    afterEach(() => {
      mongoose.connection.deleteModel('TimestampTest');
    });

    it('should automatically set created_at on document creation', async () => {
      const doc = await TestModel.create({ name: 'Test' });

      expect(doc.created_at).toBeInstanceOf(Date);
    });

    it('should automatically set updated_at on document creation', async () => {
      const doc = await TestModel.create({ name: 'Test' });

      expect(doc.updated_at).toBeInstanceOf(Date);
    });

    it('should update updated_at on document modification', async () => {
      const doc = await TestModel.create({ name: 'Test' });
      const originalUpdatedAt = doc.updated_at;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      doc.name = 'Updated Test';
      await doc.save();

      expect(doc.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should not change created_at on document modification', async () => {
      const doc = await TestModel.create({ name: 'Test' });
      const originalCreatedAt = doc.created_at;

      doc.name = 'Updated Test';
      await doc.save();

      expect(doc.created_at.getTime()).toBe(originalCreatedAt.getTime());
    });
  });

  describe('isSoftDeleteDocument', () => {
    it('should return true for soft delete documents', () => {
      const doc = {
        is_deleted: false,
        deleted_at: undefined,
      };

      expect(isSoftDeleteDocument(doc)).toBe(true);
    });

    it('should return false for non-soft delete documents', () => {
      const doc = {
        name: 'Test',
      };

      expect(isSoftDeleteDocument(doc)).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(isSoftDeleteDocument(null)).toBe(false);
      expect(isSoftDeleteDocument(undefined)).toBe(false);
    });
  });

  describe('addCommonIndexes', () => {
    it('should add created_at and updated_at indexes', () => {
      const schema = new Schema({
        name: String,
      });

      addCommonIndexes(schema);

      const indexes = schema.indexes();
      const indexFields = indexes.map((idx) => Object.keys(idx[0])[0]);

      expect(indexFields).toContain('created_at');
      expect(indexFields).toContain('updated_at');
    });

    it('should add additional custom indexes', () => {
      const schema = new Schema({
        email: String,
      });

      addCommonIndexes(schema, [{ fields: { email: 1 }, options: { unique: true } }]);

      const indexes = schema.indexes();
      const emailIndex = indexes.find((idx) => 'email' in idx[0]);

      expect(emailIndex).toBeDefined();
    });
  });
});
