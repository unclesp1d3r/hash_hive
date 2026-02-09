/**
 * Example usage of database connection and base schema
 *
 * This file demonstrates how to use the database connection
 * and base schema utilities in the HashHive backend.
 *
 * Run with: tsx src/examples/database-usage.example.ts
 */

import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import {
  type BaseDocument,
  createBaseSchema,
  type SoftDeleteDocument,
} from '../models/base.schema';

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
    await connectDatabase();
    const example = await Example.create({
      name: 'Test Example',
      value: 42,
    });

    // Update and see timestamp change
    await new Promise((resolve) => setTimeout(resolve, 100));
    example.value = 100;
    await example.save();
    await Project.create({
      name: 'Active Project',
      description: 'This project is active',
    });
    const project2 = await Project.create({
      name: 'Deleted Project',
      description: 'This project will be deleted',
    });

    // Soft delete project2
    await project2.softDelete?.();

    // Query only active projects (default behavior)
    const _activeProjects = await Project.find();

    // Query only deleted projects
    const _deletedProjects = await Project.find().onlyDeleted();

    // Query all projects
    const _allProjects = await Project.find().withDeleted();

    // Restore deleted project
    await project2.restore?.();

    const _activeAfterRestore = await Project.find();
    const _agent = await Agent.create({
      name: 'Agent 1',
      auth_token: 'unique-token-123',
      status: 'online',
    });

    // Try to create duplicate auth_token (should fail)
    try {
      await Agent.create({
        name: 'Agent 2',
        auth_token: 'unique-token-123', // Duplicate!
        status: 'online',
      });
    } catch {}
    await Example.deleteMany({});
    await Project.deleteMany({}).setOptions({ includeDeleted: true });
    await Agent.deleteMany({});
  } catch (_error) {
  } finally {
    await disconnectDatabase();
  }
}

// Run if executed directly
if (require.main === module) {
  demonstrateUsage().catch(console.error);
}

export { demonstrateUsage };
