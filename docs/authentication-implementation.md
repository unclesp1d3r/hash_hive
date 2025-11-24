# Authentication and Authorization Implementation

This document describes the authentication and authorization system implemented for HashHive, following the MERN migration specification.

## Overview

The authentication system implements a dual authentication approach:

- **JWT tokens** for Agent API (stateless, token-based authentication)
- **Session-based authentication** for Web API (stateful, cookie-based authentication)

Both authentication methods are backed by the same user model and service layer, ensuring consistency across API surfaces.

## Architecture

### Authentication Flow

#### Web API Login Flow

1. Client sends `POST /api/v1/web/auth/login` with email and password
2. `AuthService.login()` validates credentials using bcrypt
3. User roles are aggregated from all projects using `aggregateUserRoles()` helper
4. JWT token is generated with aggregated roles for API access
5. Session is created and stored in both MongoDB and Redis
6. HttpOnly cookie is set with session ID
7. User object and token are returned to client

#### Protected Request Flow

1. Client includes session cookie in request
2. `authenticateSession` middleware validates session from Redis
3. User is fetched from MongoDB and roles are aggregated from all projects
4. User object with roles is attached to `req.user`
5. Request proceeds to route handler with authenticated user context

#### Agent API Authentication

1. Agent includes JWT token in `Authorization: Bearer <token>` header
2. `authenticateJWT` middleware validates token and extracts roles from token payload
3. User is fetched from MongoDB and attached to `req.user` with roles from token
4. Request proceeds with authenticated context

### Role-Based Access Control (RBAC)

The system implements project-scoped RBAC with the following roles:

- **admin**: Full access to project, can manage all resources
- **operator**: Can manage campaigns and tasks, limited resource access
- **analyst**: Read-only access to view results and analytics
- **agent_owner**: Can manage agents and access wordlists/rulelists/masklists

Roles are assigned at the project level through the `ProjectUser` junction model, allowing users to have different roles in different projects.

## Components

### Models

#### User Model (`backend/src/models/user.model.ts`)

- Stores user credentials with bcrypt-hashed passwords (12 salt rounds)
- Tracks user status (active/disabled) and last login timestamp
- Provides `comparePassword()` instance method for password validation
- Provides `hashPassword()` static method for password hashing

#### Role Model (`backend/src/models/role.model.ts`)

- Defines available roles and their associated permissions
- Stores permission keys (e.g., 'project:read', 'campaign:create')

#### Project Model (`backend/src/models/project.model.ts`)

- Represents multi-tenant project boundaries
- Auto-generates slug from name
- Stores project settings (default priority, max agents)

#### ProjectUser Model (`backend/src/models/project-user.model.ts`)

- Junction table linking users to projects with roles
- Enforces unique constraint on [user_id, project_id]
- Enables project-scoped role assignment

#### Session Model (`backend/src/models/session.model.ts`)

- Stores session data in MongoDB for persistence
- TTL index automatically deletes expired sessions
- Complements Redis session store for fast lookups

### Services

#### AuthService (`backend/src/services/auth.service.ts`)

- `login(email, password)`: Validates credentials, aggregates user roles from all projects, and returns user + token
- `generateToken(userId, roles)`: Creates JWT with user ID and roles
- `validateToken(token)`: Verifies and decodes JWT token
- `createSession(userId)`: Creates session in MongoDB and Redis
- `validateSession(sessionId)`: Validates session from Redis and MongoDB
- `logout(sessionId)`: Removes session from both stores

#### ProjectService (`backend/src/services/project.service.ts`)

- `createProject(userId, data)`: Creates project and adds creator as admin
- `getUserProjects(userId)`: Returns all projects for a user
- `addUserToProject(projectId, userId, roles)`: Adds user to project with roles
- `removeUserFromProject(projectId, userId)`: Removes user from project
- `validateProjectAccess(userId, projectId, requiredRole?)`: Checks project access
- `getUserRolesInProject(userId, projectId)`: Returns user's roles in project

#### Role Aggregator (`backend/src/utils/role-aggregator.ts`)

- `aggregateUserRoles(userId)`: Aggregates all roles for a user across all projects
- Returns a de-duplicated array of role strings
- Used by both `AuthService.login()` and `/auth/refresh` route to ensure consistent role sets

### Middleware

#### Authentication Middleware (`backend/src/middleware/auth.middleware.ts`)

**authenticateJWT**

- Extracts Bearer token from `Authorization` header
- Validates token using `AuthService.validateToken()`
- Fetches user from database
- Extracts roles from JWT token payload
- Attaches user with roles to `req.user`
- Returns 401 with `AUTH_TOKEN_INVALID` or `AUTH_TOKEN_EXPIRED` on failure

**authenticateSession**

- Extracts session ID from `sessionId` cookie
- Validates session using `AuthService.validateSession()`
- Aggregates user roles from all projects using `aggregateUserRoles()` helper
- Attaches user with roles to `req.user`
- Returns 401 with `AUTH_SESSION_INVALID` on failure

**optionalAuth**

- Attempts authentication but doesn't fail if not authenticated
- Useful for public endpoints that show different content when authenticated

#### Authorization Middleware (`backend/src/middleware/authz.middleware.ts`)

**requireRole(...roles)**

- Factory function that returns middleware checking user roles
- Reads roles from `req.user.roles` (populated by authentication middleware)
- Checks if user has at least one of the specified roles
- Returns 403 with `AUTHZ_INSUFFICIENT_PERMISSIONS` if user lacks all required roles

**requireProjectAccess(projectIdParam)**

- Validates user has access to project using `ProjectService.validateProjectAccess()`
- Attaches project to `req.project`
- Returns 403 with `AUTHZ_PROJECT_ACCESS_DENIED` if access denied

**requireProjectRole(projectIdParam, ...roles)**

- Combines project access check with role validation
- Uses `ProjectService.getUserRolesInProject()` to check roles
- Returns 403 if user lacks required role in project

**hasPermission(user, permission)**

- Checks if user has a specific permission by querying Role model
- Aggregates permissions from all user roles stored in `user.roles`
- Returns `true` if permission is found in any of the user's roles, `false` otherwise
- Queries `Role` model to get permission arrays for each role

### Permission Helpers (`backend/src/utils/permission-helpers.ts`)

Utility functions for common permission checks:

- `canViewProject(user, projectId)`: Check if user can view project
- `canManageCampaign(user, projectId)`: Check if user can manage campaigns (admin or operator)
- `canManageAgents(user, projectId)`: Check if user can manage agents (admin or agent_owner)
- `isProjectAdmin(user, projectId)`: Check if user is project admin
- `canAccessResource(user, projectId, resourceType)`: Check resource access based on role

### Routes

#### Auth Routes (`backend/src/routes/auth.routes.ts`)

**POST /api/v1/web/auth/login**

- Validates email and password with Zod schema
- Calls `AuthService.login()`
- Sets HttpOnly session cookie
- Returns user object and JWT token

**POST /api/v1/web/auth/logout**

- Requires `authenticateSession` middleware
- Calls `AuthService.logout()` to remove session
- Clears session cookie
- Returns success message

**GET /api/v1/web/auth/me**

- Requires `authenticateSession` middleware
- Returns current user with projects and roles
- Uses `ProjectService.getUserProjects()` to fetch user's projects

**POST /api/v1/web/auth/refresh**

- Requires `authenticateSession` middleware
- Generates new JWT token with current user's roles
- Returns new token

## Usage Examples

### Protecting a Route with Session Authentication

```typescript
import { authenticateSession } from '../middleware/auth.middleware';

router.get('/protected', authenticateSession, async (req, res) => {
  // req.user is available here
  res.json({ user: req.user });
});
```

### Protecting a Route with JWT Authentication

```typescript
import { authenticateJWT } from '../middleware/auth.middleware';

router.get('/api/agent/tasks', authenticateJWT, async (req, res) => {
  // req.user is available here
  res.json({ tasks: [] });
});
```

### Requiring Project Access

```typescript
import { requireProjectAccess } from '../middleware/authz.middleware';

router.get('/projects/:projectId/campaigns',
  authenticateSession,
  requireProjectAccess('projectId'),
  async (req, res) => {
    // req.user and req.project are available here
    res.json({ campaigns: [] });
  }
);
```

### Requiring Specific Role in Project

```typescript
import { requireProjectRole } from '../middleware/authz.middleware';

router.post('/projects/:projectId/campaigns',
  authenticateSession,
  requireProjectRole('projectId', 'admin', 'operator'),
  async (req, res) => {
    // Only admin or operator can create campaigns
    res.json({ campaign: {} });
  }
);
```

### Using Permission Helpers

```typescript
import { canManageCampaign } from '../utils/permission-helpers';

router.post('/projects/:projectId/campaigns',
  authenticateSession,
  requireProjectAccess('projectId'),
  async (req, res) => {
    const canManage = await canManageCampaign(req.user!, req.project!._id.toString());
    if (!canManage) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    // Create campaign
  }
);
```

## Security Considerations

### Password Hashing

- Passwords are hashed using bcrypt with 12 salt rounds
- Passwords are never stored in plain text
- Password hash field is excluded from queries by default (`select: false`)

### Session Management

- Sessions are stored in both MongoDB (persistence) and Redis (fast lookups)
- HttpOnly cookies prevent XSS attacks
- Secure flag is set in production to enforce HTTPS
- SameSite: 'lax' prevents CSRF attacks while allowing navigation
- Sessions expire after 7 days (configurable via `SESSION_MAX_AGE`)

### Token Security

- JWT tokens are signed with HS256 algorithm using `JWT_SECRET`
- Tokens expire after 7 days (configurable via `JWT_EXPIRES_IN`)
- Token payload includes user ID and roles
- Tokens are validated on every request

### CORS Configuration

- Web API has restricted CORS (only allowed origins in development/production)
- Agent API has no CORS restrictions (distributed workers from any origin)
- Credentials are enabled for Web API to support cookie-based sessions

## Configuration

Authentication settings are configured via environment variables:

- `JWT_SECRET`: Secret key for JWT signing (minimum 32 characters)
- `JWT_EXPIRES_IN`: Token expiration (e.g., '7d', '24h', '15m')
- `SESSION_SECRET`: Secret key for session signing (minimum 32 characters)
- `SESSION_MAX_AGE`: Session expiration in milliseconds (default: 7 days)

See `backend/src/config/index.ts` for full configuration options.

## Testing

The authentication system includes comprehensive test coverage:

- **Unit tests**: Test individual service methods and middleware functions
- **Integration tests**: Test complete authentication flows with Testcontainers
- **RBAC tests**: Test role-based access control with multiple users and projects

Run tests with:

```bash
npm test                    # Unit tests
npm run test:integration    # Integration tests
```

## References

- Design document: `.kiro/specs/mern-migration/design.md`
- Requirements: `.kiro/specs/mern-migration/requirements.md`
- Tasks: `.kiro/specs/mern-migration/tasks.md`
