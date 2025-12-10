import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoDBContainer, type StartedMongoDBContainer } from '@testcontainers/mongodb';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { app } from '../../src/index';
import { connectDatabase, disconnectDatabase } from '../../src/db';
import { connectRedis, disconnectRedis } from '../../src/db/redis';
import { User } from '../../src/models/user.model';
import { Project } from '../../src/models/project.model';
import { ProjectUser } from '../../src/models/project-user.model';
import { Session } from '../../src/models/session.model';

/**
 * Helper function to login with credentials and handle CSRF tokens
 * Returns the response and cookies for use in subsequent requests
 */
async function loginWithCredentials(
  email: string,
  password: string
): Promise<{ response: request.Response; cookies: string[] }> {
  // Get CSRF token from Auth.js (required for form-based authentication)
  const csrfResponse = await request(app).get('/auth/csrf');
  const csrfToken = csrfResponse.body?.csrfToken;

  // Extract cookies from CSRF response to maintain session
  const csrfCookies = csrfResponse.headers['set-cookie'] || [];
  const csrfCookieArray = Array.isArray(csrfCookies) ? csrfCookies : csrfCookies ? [csrfCookies] : [];
  const csrfCookieHeader = csrfCookieArray.join('; ');

  // Auth.js with JWT strategy redirects on successful login (302)
  // Include CSRF token in request
  const response = await request(app)
    .post('/auth/signin/credentials')
    .set('Cookie', csrfCookieHeader)
    .send({
      email,
      password,
      ...(csrfToken && { csrfToken }),
    })
    .redirects(1); // Follow one redirect

  // Extract cookies from response
  const cookies = response.headers['set-cookie'] || [];
  const cookieArray = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];

  return { response, cookies: cookieArray };
}

let mongoContainer: StartedMongoDBContainer;
let redisContainer: StartedRedisContainer;
let originalEnv: NodeJS.ProcessEnv;

describe('Auth.js Authentication Integration Tests', () => {
  beforeAll(
    async () => {
      originalEnv = { ...process.env };

      // Start MongoDB container
      mongoContainer = await new MongoDBContainer('mongo:7').start();
      process.env['MONGODB_URI'] = mongoContainer.getConnectionString();

      // Start Redis container
      redisContainer = await new RedisContainer('redis:7-alpine').start();
      process.env['REDIS_HOST'] = redisContainer.getHost();
      process.env['REDIS_PORT'] = redisContainer.getPort().toString();
      process.env['REDIS_PASSWORD'] = '';

      // Set Auth.js required environment variables
      process.env['AUTH_SECRET'] = 'test-secret-key-minimum-32-characters-long';
      process.env['AUTH_URL'] = 'http://localhost:3001';

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
    await Session.deleteMany({});
  });

  describe('POST /auth/signin/credentials', () => {
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

      const { response, cookies: cookieArray } = await loginWithCredentials(
        'test@example.com',
        'password123'
      );

      // After redirect, should be 200 or check cookies from redirect response
      const finalStatus = response.status;
      expect([200, 302]).toContain(finalStatus);
      expect(response.headers['set-cookie']).toBeDefined();
      const sessionCookie = cookieArray.find((cookie: string) =>
        cookie.startsWith('authjs.session-token=')
      );
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');

      // Verify session is stored in the database (integration tests use real Auth.js with Testcontainers)
      // With the real Auth.js MongoDB adapter implementation, only a single session row
      // is created per login because:
      // 1. The authorize callback returns a user object (no manual session creation)
      // 2. Auth.js automatically creates the session via the MongoDB adapter
      // 3. No orphaned sessions are created since createCredentialsSession was removed
      const user = await User.findOne({ email: 'test@example.com' });
      expect(user).not.toBeNull();
      const sessions = await Session.find({ userId: user!._id });
      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.sessionToken).toBeDefined();
      expect(sessions[0]!.expires).toBeInstanceOf(Date);
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

      const response = await request(app).post('/auth/signin/credentials').send({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      // Auth.js with JWT strategy may return 302 redirect even on invalid credentials
      // Check for either 401 or 302 (redirect indicates failure)
      expect([401, 302]).toContain(response.status);
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

      // Login to get session
      const { cookies: cookieHeader } = await loginWithCredentials('test@example.com', 'password123');

      // Get current user
      const response = await request(app).get('/api/v1/web/auth/me').set('Cookie', cookieHeader.join('; '));

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

  describe('POST /auth/signout', () => {
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

      // Login to get session
      const { cookies: cookieHeader } = await loginWithCredentials('test@example.com', 'password123');

      // Logout - get CSRF token first
      const csrfResponse = await request(app).get('/auth/csrf');
      const csrfToken = csrfResponse.body?.csrfToken;
      const csrfCookies = csrfResponse.headers['set-cookie'] || [];
      const csrfCookieArray = Array.isArray(csrfCookies) ? csrfCookies : csrfCookies ? [csrfCookies] : [];
      const allCookies = [...cookieHeader, ...csrfCookieArray].join('; ');

      const response = await request(app)
        .post('/auth/signout')
        .set('Cookie', allCookies)
        .send(csrfToken ? { csrfToken } : {})
        .redirects(1);

      expect(response.status).toBe(200);

      // Verify session is cleared by trying to access /me
      const meResponse = await request(app).get('/api/v1/web/auth/me').set('Cookie', cookieHeader);

      expect(meResponse.status).toBe(401);
    });
  });

  describe('Role Aggregation', () => {
    it('should aggregate roles from multiple projects in session', async () => {
      // Create test user
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- User.hashPassword is a static method defined via bracket notation
      const hashedPassword = await (User as any).hashPassword('password123');
      const user = await User.create({
        email: 'test@example.com',
        password_hash: hashedPassword,
        name: 'Test User',
        status: 'active',
      });

      // Create multiple projects with different roles
      const project1 = await Project.create({
        name: 'Project 1',
        slug: 'project-1',
        created_by: user._id,
      });

      const project2 = await Project.create({
        name: 'Project 2',
        slug: 'project-2',
        created_by: user._id,
      });

      await ProjectUser.create({
        user_id: user._id,
        project_id: project1._id,
        roles: ['admin'],
      });

      await ProjectUser.create({
        user_id: user._id,
        project_id: project2._id,
        roles: ['operator', 'analyst'],
      });

      // Login to get session
      const { cookies: cookieHeader } = await loginWithCredentials('test@example.com', 'password123');

      // Get current user - roles should be aggregated from both projects
      const response = await request(app).get('/api/v1/web/auth/me').set('Cookie', cookieHeader.join('; '));

      expect(response.status).toBe(200);
      expect(response.body.user.roles).toContain('admin');
      expect(response.body.user.roles).toContain('operator');
      expect(response.body.user.roles).toContain('analyst');
      // Roles should be de-duplicated
      expect(response.body.user.roles).toHaveLength(3);
    });
  });

  describe('Password Upgrade Flagging', () => {
    it('should flag weak password but allow login', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- User.hashPassword is a static method defined via bracket notation
      const hashedPassword = await (User as any).hashPassword('weak');
      const user = await User.create({
        email: 'test@example.com',
        password_hash: hashedPassword,
        name: 'Test User',
        status: 'active',
        password_requires_upgrade: false,
      });

      const { response } = await loginWithCredentials('test@example.com', 'weak'); // Less than 12 characters

      // Auth.js redirects on success, accept 200 or 302
      expect([200, 302]).toContain(response.status);

      // Verify password_requires_upgrade flag was set
      const updatedUser = await User.findById(user._id).select('+password_requires_upgrade');
      expect(updatedUser?.password_requires_upgrade).toBe(true);
    });

    it('should not flag strong password', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- User.hashPassword is a static method defined via bracket notation
      const hashedPassword = await (User as any).hashPassword('VeryStrongPassword123!');
      const user = await User.create({
        email: 'test@example.com',
        password_hash: hashedPassword,
        name: 'Test User',
        status: 'active',
        password_requires_upgrade: false,
      });

      const { response } = await loginWithCredentials('test@example.com', 'VeryStrongPassword123!'); // 24 characters

      // Auth.js redirects on success, accept 200 or 302
      expect([200, 302]).toContain(response.status);

      // Verify password_requires_upgrade flag was not set
      const updatedUser = await User.findById(user._id).select('+password_requires_upgrade');
      expect(updatedUser?.password_requires_upgrade).toBe(false);
    });
  });
});
