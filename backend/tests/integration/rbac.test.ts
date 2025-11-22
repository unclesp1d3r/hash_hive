import { MongoDBContainer, StartedMongoDBContainer } from '@testcontainers/mongodb';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { connectDatabase, disconnectDatabase } from '../../src/db';
import { connectRedis, disconnectRedis } from '../../src/db/redis';
import { User } from '../../src/models/user.model';
import { Project } from '../../src/models/project.model';
import { ProjectUser } from '../../src/models/project-user.model';
import {
  canViewProject,
  canManageCampaign,
  isProjectAdmin,
} from '../../src/utils/permission-helpers';

let mongoContainer: StartedMongoDBContainer;
let redisContainer: StartedRedisContainer;
let originalEnv: NodeJS.ProcessEnv;

describe('RBAC Integration Tests', () => {
  beforeAll(async () => {
    originalEnv = { ...process.env };

    // Start MongoDB container
    mongoContainer = await new MongoDBContainer('mongo:7').start();
    process.env['MONGODB_URI'] = mongoContainer.getConnectionString();

    // Start Redis container
    redisContainer = await new RedisContainer('redis:7-alpine').start();
    process.env['REDIS_HOST'] = redisContainer.getHost();
    process.env['REDIS_PORT'] = redisContainer.getPort().toString();
    process.env['REDIS_PASSWORD'] = '';

    // Connect to databases
    await connectDatabase();
    await connectRedis();
  });

  afterAll(async () => {
    await disconnectDatabase();
    await disconnectRedis();

    if (mongoContainer) {
      await mongoContainer.stop();
    }
    if (redisContainer) {
      await redisContainer.stop();
    }

    process.env = originalEnv;
  });

  beforeEach(async () => {
    // Clean up collections before each test
    await User.deleteMany({});
    await Project.deleteMany({});
    await ProjectUser.deleteMany({});
  });

  describe('Project-scoped access', () => {
    it('should allow user with admin role in project A to access project A but not project B', async () => {
      // Create users
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- User.hashPassword is a static method defined via bracket notation
      const hashedPassword = await (User as any).hashPassword('password123');
      const adminUser = await User.create({
        email: 'admin@example.com',
        password_hash: hashedPassword,
        name: 'Admin User',
        status: 'active',
      });

      const otherUser = await User.create({
        email: 'other@example.com',
        password_hash: hashedPassword,
        name: 'Other User',
        status: 'active',
      });

      // Create projects
      const projectA = await Project.create({
        name: 'Project A',
        slug: 'project-a',
        created_by: adminUser._id,
      });

      const projectB = await Project.create({
        name: 'Project B',
        slug: 'project-b',
        created_by: otherUser._id,
      });

      // Add admin user to project A as admin
      await ProjectUser.create({
        user_id: adminUser._id,
        project_id: projectA._id,
        roles: ['admin'],
      });

      // Test permission helpers
      const canViewA = await canViewProject(
        {
          id: adminUser._id.toString(),
          email: adminUser.email,
          name: adminUser.name,
          status: adminUser.status,
          last_login_at: null,
          created_at: adminUser.created_at,
          updated_at: adminUser.updated_at,
        },
        projectA._id.toString()
      );

      const canViewB = await canViewProject(
        {
          id: adminUser._id.toString(),
          email: adminUser.email,
          name: adminUser.name,
          status: adminUser.status,
          last_login_at: null,
          created_at: adminUser.created_at,
          updated_at: adminUser.updated_at,
        },
        projectB._id.toString()
      );

      expect(canViewA).toBe(true);
      expect(canViewB).toBe(false);
    });
  });

  describe('Role-based permissions', () => {
    it('should allow admin and operator to manage campaigns', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- User.hashPassword is a static method defined via bracket notation
      const hashedPassword = await (User as any).hashPassword('password123');
      const adminUser = await User.create({
        email: 'admin@example.com',
        password_hash: hashedPassword,
        name: 'Admin User',
        status: 'active',
      });

      const operatorUser = await User.create({
        email: 'operator@example.com',
        password_hash: hashedPassword,
        name: 'Operator User',
        status: 'active',
      });

      const analystUser = await User.create({
        email: 'analyst@example.com',
        password_hash: hashedPassword,
        name: 'Analyst User',
        status: 'active',
      });

      const project = await Project.create({
        name: 'Test Project',
        slug: 'test-project',
        created_by: adminUser._id,
      });

      await ProjectUser.create({
        user_id: adminUser._id,
        project_id: project._id,
        roles: ['admin'],
      });

      await ProjectUser.create({
        user_id: operatorUser._id,
        project_id: project._id,
        roles: ['operator'],
      });

      await ProjectUser.create({
        user_id: analystUser._id,
        project_id: project._id,
        roles: ['analyst'],
      });

      const adminCanManage = await canManageCampaign(
        {
          id: adminUser._id.toString(),
          email: adminUser.email,
          name: adminUser.name,
          status: adminUser.status,
          last_login_at: null,
          created_at: adminUser.created_at,
          updated_at: adminUser.updated_at,
        },
        project._id.toString()
      );

      const operatorCanManage = await canManageCampaign(
        {
          id: operatorUser._id.toString(),
          email: operatorUser.email,
          name: operatorUser.name,
          status: operatorUser.status,
          last_login_at: null,
          created_at: operatorUser.created_at,
          updated_at: operatorUser.updated_at,
        },
        project._id.toString()
      );

      const analystCanManage = await canManageCampaign(
        {
          id: analystUser._id.toString(),
          email: analystUser.email,
          name: analystUser.name,
          status: analystUser.status,
          last_login_at: null,
          created_at: analystUser.created_at,
          updated_at: analystUser.updated_at,
        },
        project._id.toString()
      );

      expect(adminCanManage).toBe(true);
      expect(operatorCanManage).toBe(true);
      expect(analystCanManage).toBe(false);
    });
  });

  describe('Permission helpers', () => {
    it('should correctly identify project admin', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- User.hashPassword is a static method defined via bracket notation
      const hashedPassword = await (User as any).hashPassword('password123');
      const adminUser = await User.create({
        email: 'admin@example.com',
        password_hash: hashedPassword,
        name: 'Admin User',
        status: 'active',
      });

      const regularUser = await User.create({
        email: 'regular@example.com',
        password_hash: hashedPassword,
        name: 'Regular User',
        status: 'active',
      });

      const project = await Project.create({
        name: 'Test Project',
        slug: 'test-project',
        created_by: adminUser._id,
      });

      await ProjectUser.create({
        user_id: adminUser._id,
        project_id: project._id,
        roles: ['admin'],
      });

      await ProjectUser.create({
        user_id: regularUser._id,
        project_id: project._id,
        roles: ['analyst'],
      });

      const adminIsAdmin = await isProjectAdmin(
        {
          id: adminUser._id.toString(),
          email: adminUser.email,
          name: adminUser.name,
          status: adminUser.status,
          last_login_at: null,
          created_at: adminUser.created_at,
          updated_at: adminUser.updated_at,
        },
        project._id.toString()
      );

      const regularIsAdmin = await isProjectAdmin(
        {
          id: regularUser._id.toString(),
          email: regularUser.email,
          name: regularUser.name,
          status: regularUser.status,
          last_login_at: null,
          created_at: regularUser.created_at,
          updated_at: regularUser.updated_at,
        },
        project._id.toString()
      );

      expect(adminIsAdmin).toBe(true);
      expect(regularIsAdmin).toBe(false);
    });
  });
});
