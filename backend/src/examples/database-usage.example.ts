/**
 * Example usage of database connection and base schema
 *
 * This file demonstrates how to use the database connection
 * and base schema utilities in the HashHive backend.
 *
 * Run with: tsx src/examples/database-usage.example.ts
 */

import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase, isMongoConnected } from '../config/database';
import { createBaseSchema, BaseDocument, SoftDeleteDocument } from '../models/base.schema';

// Example 1: Simple model with timestamps
interface IExample extends BaseDocument {
  name: string;
  value: number;
}

const exampleSchema = createBaseSchema<IExample>({
  name: { type: String, required: true },
  value: { type: Number, required: true },
});

const Example = mongoose.model<IExample>('Example', exampleSchema);

// Example 2: Model with soft delete
interface IProject extends SoftDeleteDocument {
  name: string;
  description: string;
}

const projectSchema = createBaseSchema<IProject>(
  {
    name: { type: String, required: true },
    description: { type: String },
  },
  {},
  true // Enable soft delete
);

const Project = mongoose.model<IProject>('Project', projectSchema);

// Example 3: Model with custom indexes
interface IAgent extends BaseDocument {
  name: string;
  auth_token: string;
  status: string;
}

const agentSchema = createBaseSchema<IAgent>(
  {
    name: { type: String, required: true },
    auth_token: { type: String, required: true },
    status: { type: String, required: true },
  },
  {},
  false,
  [
    { fields: { auth_token: 1 }, options: { unique: true } },
    { fields: { status: 1, created_at: -1 } },
  ]
);

const Agent = mongoose.model<IAgent>('Agent', agentSchema);

async function demonstrateUsage() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await connectDatabase();
    console.log('✅ Connected:', isMongoConnected());

    // Example 1: Basic CRUD with timestamps
    console.log('\n📝 Example 1: Basic model with timestamps');
    const example = await Example.create({
      name: 'Test Example',
      value: 42,
    });
    console.log('Created:', {
      id: example._id,
      name: example.name,
      created_at: example.created_at,
      updated_at: example.updated_at,
    });

    // Update and see timestamp change
    await new Promise((resolve) => setTimeout(resolve, 100));
    example.value = 100;
    await example.save();
    console.log('Updated:', {
      value: example.value,
      updated_at: example.updated_at,
    });

    // Example 2: Soft delete
    console.log('\n🗑️  Example 2: Soft delete functionality');
    const project1 = await Project.create({
      name: 'Active Project',
      description: 'This project is active',
    });
    const project2 = await Project.create({
      name: 'Deleted Project',
      description: 'This project will be deleted',
    });

    // Soft delete project2
    await project2.softDelete!();
    console.log('Soft deleted project2');

    // Query only active projects (default behavior)
    const activeProjects = await Project.find();
    console.log('Active projects:', activeProjects.length); // Should be 1

    // Query only deleted projects
    const deletedProjects = await Project.find().onlyDeleted();
    console.log('Deleted projects:', deletedProjects.length); // Should be 1

    // Query all projects
    const allProjects = await Project.find().withDeleted();
    console.log('All projects:', allProjects.length); // Should be 2

    // Restore deleted project
    await project2.restore!();
    console.log('Restored project2');

    const activeAfterRestore = await Project.find();
    console.log('Active after restore:', activeAfterRestore.length); // Should be 2

    // Example 3: Custom indexes
    console.log('\n🔍 Example 3: Model with custom indexes');
    const agent = await Agent.create({
      name: 'Agent 1',
      auth_token: 'unique-token-123',
      status: 'online',
    });
    console.log('Created agent:', {
      id: agent._id,
      name: agent.name,
      status: agent.status,
    });

    // Try to create duplicate auth_token (should fail)
    try {
      await Agent.create({
        name: 'Agent 2',
        auth_token: 'unique-token-123', // Duplicate!
        status: 'online',
      });
    } catch (error: any) {
      console.log('✅ Unique index working - duplicate prevented');
    }

    // Clean up
    console.log('\n🧹 Cleaning up...');
    await Example.deleteMany({});
    await Project.deleteMany({}).setOptions({ includeDeleted: true });
    await Agent.deleteMany({});

    console.log('✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await disconnectDatabase();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run if executed directly
if (require.main === module) {
  demonstrateUsage().catch(console.error);
}

export { demonstrateUsage };
