# Authentication and Authorization Implementation

This document describes the authentication and authorization system implemented for HashHive using **Auth.js v5** with **@auth/express** for Express backend integration, following the MERN migration specification.

## Overview

The authentication system implements a dual authentication approach:

- **JWT tokens** for Agent API (stateless, token-based authentication)
- **Session-based authentication** for Web API (stateful, cookie-based authentication using Auth.js)

Both authentication methods are backed by the same user model and service layer, ensuring consistency across API surfaces. The system uses **Auth.js v5** with the **@auth/express** package for Express backend integration and **@auth/mongodb-adapter** for session storage.

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

#### Protected Request Flow (Auth.js)

1. Client includes Auth.js session cookie in request
2. `authenticateSession` middleware uses `getSession()` from `@auth/express` to validate session
3. Session is validated against MongoDB (via Auth.js adapter)
4. User is fetched from MongoDB and roles are retrieved from session (already aggregated in callback)
5. User object with roles is attached to `req.user`
6. Request proceeds to route handler with authenticated user context

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

#### AuthService (`backend/src/services/auth.service.authjs.ts`)

- `login(req, email, password)`: Uses Auth.js `signIn()` to authenticate user
- `logout(req)`: Uses Auth.js `signOut()` to clear session
- `getSession(req)`: Uses Auth.js `getSession()` to retrieve current session
- `getUser(req)`: Gets user from session

**Note**: Role aggregation is handled in Auth.js callbacks (see `backend/src/config/auth.config.ts`), not in the service layer.

#### ProjectService (`backend/src/services/project.service.ts`)

- `createProject(userId, data)`: Creates project and adds creator as admin
- `getUserProjects(userId)`: Returns all projects for a user
- `addUserToProject(projectId, userId, roles)`: Adds user to project with roles
- `removeUserFromProject(projectId, userId)`: Removes user from project
- `validateProjectAccess(userId, projectId, requiredRole?)`: Checks project access
- `getUserRolesInProject(userId, projectId)`: Returns user's roles in project

#### Role Aggregation (Auth.js Callbacks)

- Role aggregation is handled in Auth.js `session` and `jwt` callbacks (see `backend/src/config/auth.config.ts`)
- `aggregateUserRoles(userId)` function aggregates all roles for a user across all projects
- Returns a de-duplicated array of role strings
- Roles are automatically attached to session objects via callbacks

### Middleware

#### Authentication Middleware (`backend/src/middleware/auth.middleware.authjs.ts`)

**authenticateJWT**

- Extracts Bearer token from `Authorization` header
- Validates token using `AuthService.validateToken()`
- Fetches user from database
- Extracts roles from JWT token payload
- Attaches user with roles to `req.user`
- Returns 401 with `AUTH_TOKEN_INVALID` or `AUTH_TOKEN_EXPIRED` on failure

**authenticateSession**

- Uses `getSession()` from `@auth/express` to validate Auth.js session
- Validates session against MongoDB (via Auth.js adapter)
- Retrieves user from database and validates status
- Uses roles from session (already aggregated in Auth.js callback)
- Attaches user with roles to `req.user` and stores session in `res.locals.session`
- Returns 401 with `AUTH_SESSION_INVALID` on failure

**optionalAuth**

- Attempts authentication but doesn't fail if not authenticated
- Useful for public endpoints that show different content when authenticated

#### Authorization Middleware (`backend/src/middleware/authz.middleware.authjs.ts`)

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

#### Auth Routes (Auth.js)

Auth.js core routes are mounted directly in `backend/src/index.ts` at `/auth/*` using `ExpressAuth(authConfig)`:

- `POST /auth/signin/credentials` - Login with email and password
- `POST /auth/signout` - Logout and clear session
- `GET /auth/callback` - OAuth callback (if OAuth providers are added)

**GET /api/v1/web/auth/me** (`backend/src/routes/auth.routes.authjs.ts`)

- Uses `getSession()` from `@auth/express` to get current session
- Returns current user with projects and roles
- Uses `ProjectService.getUserProjects()` to fetch user's projects

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

### Session Management (Auth.js)

- Sessions are stored in MongoDB via `@auth/mongodb-adapter`
- Auth.js manages session lifecycle automatically
- HttpOnly cookies prevent XSS attacks
- Secure flag is set in production to enforce HTTPS
- SameSite: 'lax' prevents CSRF attacks while allowing navigation
- Sessions expire after 7 days (configurable via `SESSION_MAX_AGE` or `AUTH_MAX_AGE`)

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

- `AUTH_SECRET`: Secret key for Auth.js (required, minimum 32 characters)
- `AUTH_URL`: Base URL for Auth.js callbacks (e.g., '<http://localhost:3001>')
- `JWT_SECRET`: Secret key for JWT signing (minimum 32 characters, for Agent API)
- `JWT_EXPIRES_IN`: Token expiration (e.g., '7d', '24h', '15m')
- `SESSION_SECRET`: Secret key for session signing (minimum 32 characters, legacy)
- `SESSION_MAX_AGE`: Session expiration in milliseconds (default: 7 days)

Auth.js configuration is defined in `backend/src/config/auth.config.ts` using `@auth/express` and `@auth/mongodb-adapter`.

See `backend/src/config/index.ts` for full configuration options.

For frontend configuration:
- `NEXT_PUBLIC_API_URL`: Base URL for backend API (used by Auth.js client)
- `NEXTAUTH_URL`: Base URL of the application (optional for next-auth v5)
- `NEXTAUTH_SECRET`: Secret key for NextAuth (optional, can use AUTH_SECRET from backend)

See `backend/.env.example` and `frontend/.env.example` for example environment variable configurations.

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
