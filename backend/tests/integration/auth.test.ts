import request from 'supertest';
import { MongoDBContainer, type StartedMongoDBContainer } from '@testcontainers/mongodb';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { app } from '../../src/index';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';
import { connectRedis, disconnectRedis } from '../../src/db/redis';
import { User } from '../../src/models/user.model';
import { Project } from '../../src/models/project.model';
import { ProjectUser } from '../../src/models/project-user.model';
import { getCsrfToken, getCsrfTokenWithSession } from '../helpers/csrf';

let mongoContainer: StartedMongoDBContainer;
let redisContainer: StartedRedisContainer;
let originalEnv: NodeJS.ProcessEnv;

describe('Authentication Integration Tests', () => {
  beforeAll(
    async () => {
      originalEnv = { ...process.env };

      // Start MongoDB container
      mongoContainer = await new MongoDBContainer('mongo:7').start();
      // Use getConnectionString() directly - directConnection: true in database.ts handles container hostname
      process.env['MONGODB_URI'] = mongoContainer.getConnectionString();

      // Start Redis container
      redisContainer = await new RedisContainer('redis:7-alpine').start();
      process.env['REDIS_HOST'] = redisContainer.getHost();
      process.env['REDIS_PORT'] = redisContainer.getPort().toString();
      process.env['REDIS_PASSWORD'] = '';

      // Connect to databases
      await connectDatabase();
      await connectRedis();
    },
    120000 // 120 second timeout for container startup
  );

  afterAll(async () => {
    // Cleanup order: services first, then containers
    await disconnectDatabase();
    await disconnectRedis();

    if (redisContainer) {
      await redisContainer.stop();
    }
    if (mongoContainer) {
      await mongoContainer.stop();
    }

    process.env = originalEnv;
  });

  beforeEach(async () => {
    // Clean up collections before each test
    await User.deleteMany({});
    await Project.deleteMany({});
    await ProjectUser.deleteMany({});
  });

  describe('POST /api/v1/web/auth/login', () => {
    it('should login with valid credentials and set session cookie', async () => {
      // Create test user
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- User.hashPassword is a static method defined via bracket notation
      const hashedPassword = await (User as any).hashPassword('password123');
      await User.create({
        email: 'test@example.com',
        password_hash: hashedPassword,
        name: 'Test User',
        status: 'active',
      });

      // Get CSRF token for state-changing request
      const { token: csrfToken, cookie: csrfCookie } = await getCsrfToken(app);

      const response = await request(app)
        .post('/api/v1/web/auth/login')
        .set('Cookie', csrfCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.headers['set-cookie']).toBeDefined();

      // Normalize set-cookie header to array (can be string or string[])
      const cookies = response.headers['set-cookie'];
      const cookieArray = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
      const sessionCookie = cookieArray.find((cookie: string) => cookie.startsWith('sessionId='));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
    });

    it('should return 401 with invalid credentials', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- User.hashPassword is a static method defined via bracket notation
      const hashedPassword = await (User as any).hashPassword('password123');
      await User.create({
        email: 'test@example.com',
        password_hash: hashedPassword,
        name: 'Test User',
        status: 'active',
      });

      // Get CSRF token for state-changing request
      const { token: csrfToken, cookie: csrfCookie } = await getCsrfToken(app);

      const response = await request(app)
        .post('/api/v1/web/auth/login')
        .set('Cookie', csrfCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/v1/web/auth/me', () => {
    it('should return current user with projects and roles', async () => {
      // Create test user
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- User.hashPassword is a static method defined via bracket notation
      const hashedPassword = await (User as any).hashPassword('password123');
      const user = await User.create({
        email: 'test@example.com',
        password_hash: hashedPassword,
        name: 'Test User',
        status: 'active',
      });

      // Create project and add user
      const project = await Project.create({
        name: 'Test Project',
        slug: 'test-project',
        created_by: user._id,
      });

      await ProjectUser.create({
        user_id: user._id,
        project_id: project._id,
        roles: ['admin'],
      });

      // Get CSRF token for login request
      const { token: csrfToken, cookie: csrfCookie } = await getCsrfToken(app);

      // Login to get session
      const loginResponse = await request(app)
        .post('/api/v1/web/auth/login')
        .set('Cookie', csrfCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      const cookies = loginResponse.headers['set-cookie'];
      const cookieHeader = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];

      // Get current user (GET requests don't require CSRF token)
      const response = await request(app).get('/api/v1/web/auth/me').set('Cookie', cookieHeader);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('projects');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.projects).toHaveLength(1);
      expect(response.body.projects[0].roles).toContain('admin');
    });

    it('should return 401 without session', async () => {
      const response = await request(app).get('/api/v1/web/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_SESSION_INVALID');
    });
  });

  describe('POST /api/v1/web/auth/logout', () => {
    it('should logout and clear session cookie', async () => {
      // Create test user
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- User.hashPassword is a static method defined via bracket notation
      const hashedPassword = await (User as any).hashPassword('password123');
      await User.create({
        email: 'test@example.com',
        password_hash: hashedPassword,
        name: 'Test User',
        status: 'active',
      });

      // Get CSRF token for login request
      const { token: loginCsrfToken, cookie: loginCsrfCookie } = await getCsrfToken(app);

      // Login to get session
      const loginResponse = await request(app)
        .post('/api/v1/web/auth/login')
        .set('Cookie', loginCsrfCookie)
        .set('X-CSRF-Token', loginCsrfToken)
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      const cookies = loginResponse.headers['set-cookie'];
      const cookieHeader = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];

      // Get CSRF token with session for logout request
      const { token: logoutCsrfToken, cookies: logoutCookies } = await getCsrfTokenWithSession(
        app,
        cookieHeader
      );

      // Logout
      const response = await request(app)
        .post('/api/v1/web/auth/logout')
        .set('Cookie', logoutCookies)
        .set('X-CSRF-Token', logoutCsrfToken);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');

      // Verify session is cleared by trying to access /me
      const meResponse = await request(app).get('/api/v1/web/auth/me').set('Cookie', cookieHeader);

      expect(meResponse.status).toBe(401);
    });
  });
});
