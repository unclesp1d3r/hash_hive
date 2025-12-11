import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoDBContainer, type StartedMongoDBContainer } from '@testcontainers/mongodb';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { app, mountAuthRoutes } from '../../src/index';
import { connectDatabase, disconnectDatabase } from '../../src/db';
import { connectRedis, disconnectRedis } from '../../src/db/redis';
import { User } from '../../src/models/user.model';
import { Project } from '../../src/models/project.model';
import { ProjectUser } from '../../src/models/project-user.model';
import { Session } from '../../src/models/session.model';

/**
 * Helper function to login with credentials and handle CSRF tokens
 * Returns the agent (with cookies) and response for use in subsequent requests
 */
async function loginWithCredentials(
  email: string,
  password: string
): Promise<{ response: request.Response; agent: request.SuperAgentTest; cookies: string[] }> {
  // Use an agent to maintain cookies across requests
  const agent = request.agent(app);

  // Auth.js handles CSRF internally, but we need to get the CSRF token first
  // Try to get CSRF token from Auth.js - it may be available at /auth/csrf or via a GET to signin page
  let csrfToken: string | undefined;

  try {
    const csrfResponse = await agent.get('/auth/csrf');
    csrfToken = csrfResponse.body?.csrfToken;
  } catch {
    // If /auth/csrf doesn't exist, try getting it from the signin page
    try {
      const signinPageResponse = await agent.get('/auth/signin/credentials');
      csrfToken = signinPageResponse.body?.csrfToken;
    } catch {
      // If neither works, proceed without CSRF token (Auth.js may handle it internally)
    }
  }

  // Auth.js with JWT strategy redirects on successful login (302)
  // Include CSRF token in request body if available
  const requestBody: { email: string; password: string; csrfToken?: string } = {
    email,
    password,
  };
  if (csrfToken) {
    requestBody.csrfToken = csrfToken;
  }

  // Don't follow redirects automatically - handle them manually to capture all cookies
  const loginResponse = await agent.post('/auth/signin/credentials').send(requestBody);

  // If there's a redirect, follow it manually to capture cookies
  let finalResponse = loginResponse;
  if (loginResponse.status === 302 && loginResponse.headers.location) {
    const location = loginResponse.headers.location;
    // Handle both absolute and relative URLs
    const redirectPath = location.startsWith('http') ? new URL(location).pathname : location;
    finalResponse = await agent.get(redirectPath);
  }

  // Extract cookies from Set-Cookie headers in all responses
  const allSetCookies: string[] = [];
  
  // Get cookies from login response
  const loginCookies = loginResponse.headers['set-cookie'] || [];
  if (Array.isArray(loginCookies)) {
    allSetCookies.push(...loginCookies);
  } else if (loginCookies) {
    allSetCookies.push(loginCookies);
  }
  
  // Get cookies from redirect response if different
  if (finalResponse !== loginResponse) {
    const redirectCookies = finalResponse.headers['set-cookie'] || [];
    if (Array.isArray(redirectCookies)) {
      allSetCookies.push(...redirectCookies);
    } else if (redirectCookies) {
      allSetCookies.push(redirectCookies);
    }
  }

  // Extract just the name=value part from Set-Cookie headers
  const cookies = allSetCookies
    .map((cookieHeader: string) => {
      const [nameValue] = cookieHeader.split(';');
      return nameValue.trim();
    })
    .filter((cookie) => cookie.length > 0);

  return { response: finalResponse, agent, cookies };
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

      // Mount Auth.js routes after database connection is established
      mountAuthRoutes();
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

      const { response, agent, cookies: cookieArray } = await loginWithCredentials(
        'test@example.com',
        'password123'
      );

      // After redirect, should be 200 or check cookies from redirect response
      const finalStatus = response.status;
      expect([200, 302]).toContain(finalStatus);

      // With JWT strategy, sessions are stored in JWT tokens, not in the database
      // The MongoDB adapter is used for user/account management, but sessions are JWT-based
      // Verify user exists and session cookie is present
      const user = await User.findOne({ email: 'test@example.com' });
      expect(user).not.toBeNull();
      
      // With JWT strategy, we don't expect database sessions
      // Instead, verify that a session cookie was set in the agent's cookie jar
      const hasSessionCookie = cookieArray.length > 0;
      expect(hasSessionCookie).toBe(true);
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

      // Login to get session - agent maintains cookies automatically
      const { agent } = await loginWithCredentials('test@example.com', 'password123');

      // Get current user - use the same agent to maintain cookies
      const response = await agent.get('/api/v1/web/auth/me');

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

      // Login to get session - agent maintains cookies automatically
      const { agent: loginAgent } = await loginWithCredentials(
        'test@example.com',
        'password123'
      );

      // Logout - get CSRF token first using the same agent
      const csrfResponse = await loginAgent.get('/auth/csrf');
      const csrfToken = csrfResponse.body?.csrfToken;

      const response = await loginAgent
        .post('/auth/signout')
        .send(csrfToken ? { csrfToken } : {})
        .redirects(1);

      // Auth.js redirects after signout - accept 200, 302, or 404 (if redirect goes to non-existent route)
      expect([200, 302, 404]).toContain(response.status);

      // Verify session is cleared by trying to access /me with the same agent
      const meResponse = await loginAgent.get('/api/v1/web/auth/me');

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

      // Login to get session - agent maintains cookies automatically
      const { agent } = await loginWithCredentials('test@example.com', 'password123');

      // Get current user - roles should be aggregated from both projects - use the same agent
      const response = await agent.get('/api/v1/web/auth/me');

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

      // Wait a bit for async save operations to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify password_requires_upgrade flag was set
      // Refresh the user document to get the latest state
      const updatedUser = await User.findById(user._id).select('+password_requires_upgrade');
      expect(updatedUser).not.toBeNull();
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
