# Auth.js Migration Guide

This guide documents the migration from the legacy custom authentication system to **Auth.js v5** using **@auth/express** for Express backend integration.

## Overview

The migration replaces the custom authentication implementation with Auth.js v5, which provides:

- Standardized authentication flows
- Built-in session management via MongoDB adapter
- OAuth provider support (for future use)
- Improved security and maintainability

## Migration Steps

### 1. Data Migration

Run the migration script to migrate existing users and sessions to Auth.js schema:

**Note:** Migration script was removed as the system is not in production and there are no existing users to migrate. Auth.js will create users in the correct schema format automatically when new users are created.

### 2. Environment Variables

Update your `.env` files with Auth.js required variables:

**Backend (.env)**:

```env
AUTH_SECRET=your-secret-key-minimum-32-characters-long
AUTH_URL=http://localhost:3001
```

**Frontend (.env.local)**:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Code Changes

#### Backend

- **Routes**: Auth.js routes are mounted at `/auth/*` in `backend/src/index.ts`
- **Middleware**: Use `authenticateSession` from `backend/src/middleware/auth.middleware.authjs.ts`
- **Services**: Use `AuthService` from `backend/src/services/auth.service.authjs.ts`
- **Config**: Auth.js configuration is in `backend/src/config/auth.config.ts`

#### Frontend

- **Providers**: Wrap app with `SessionProvider` from `frontend/lib/auth.ts`
- **Components**: Use `useSession`, `signIn`, `signOut` hooks from `next-auth/react`
- **Login**: Use `LoginForm` component from `frontend/components/auth/login-form.tsx`
- **Protection**: Use `ProtectedRoute` component from `frontend/components/auth/protected-route.tsx`

### 4. Testing

Run the test suite to verify migration:

```bash
npm test                    # Unit tests
npm run test:integration    # Integration tests
```

Key test files:

- `backend/tests/integration/auth.authjs.test.ts` - Integration tests for Auth.js flows
- `backend/tests/unit/auth.middleware.authjs.test.ts` - Middleware unit tests
- `backend/tests/unit/authz.middleware.authjs.test.ts` - Authorization middleware tests

### 5. Rollback Plan

If migration fails, rollback steps:

1. **Database**: Restore from backup (migration modifies `users` and `sessions` collections)
2. **Code**: Revert to legacy auth files:
   - `backend/src/routes/auth.routes.ts`
   - `backend/src/middleware/auth.middleware.ts`
   - `backend/src/middleware/authz.middleware.ts`
   - `backend/src/services/auth.service.ts`
3. **Routes**: Update `backend/src/routes/index.ts` to use legacy routes
4. **Dependencies**: Remove `@auth/express` and `@auth/mongodb-adapter` from `package.json`

## Breaking Changes

### API Endpoints

- **Login**: Changed from `POST /api/v1/web/auth/login` to `POST /auth/signin/credentials`
- **Logout**: Changed from `POST /api/v1/web/auth/logout` to `POST /auth/signout`
- **Me**: Remains at `GET /api/v1/web/auth/me` but uses Auth.js session

### Session Cookies

- **Cookie name**: Changed from `sessionId` to `authjs.session-token`
- **Session storage**: Moved from Redis+MongoDB to MongoDB-only (via Auth.js adapter)

### Middleware

- **Import paths**: Changed from `auth.middleware.ts` to `auth.middleware.authjs.ts`
- **Session validation**: Uses `getSession()` from `@auth/express` instead of custom validation

### Frontend

- **Hooks**: Use `useSession` from `next-auth/react` instead of custom hooks
- **Sign in/out**: Use `signIn` and `signOut` from `next-auth/react`

## RBAC Integration

Role aggregation is now handled in Auth.js callbacks (`backend/src/config/auth.config.ts`):

- **JWT callback**: Aggregates roles when JWT token is created
- **Session callback**: Aggregates roles when session is created/refreshed
- **Project-user relations**: Preserved in existing `ProjectUser` model

Roles are automatically attached to session objects, eliminating the need for manual role aggregation in middleware.

## Troubleshooting

### Session Not Persisting

- Verify `AUTH_SECRET` is set and at least 32 characters
- Check `AUTH_URL` matches your backend URL
- Ensure MongoDB connection is working (Auth.js adapter requires MongoDB)

### Roles Not Appearing

- Verify `ProjectUser` records exist for the user
- Check Auth.js callbacks in `auth.config.ts` are executing
- Review logs for callback errors

### CORS Issues

- Ensure `AUTH_URL` includes the correct origin
- Check CORS configuration in `backend/src/index.ts`
- Verify `trustHost: true` is set in `auth.config.ts`

## References

- [Auth.js Documentation](https://authjs.dev/)
- [@auth/express Documentation](https://authjs.dev/getting-started/installation?framework=express)
- [@auth/mongodb-adapter Documentation](https://authjs.dev/reference/adapter/mongodb)
- Design document: `.kiro/specs/mern-migration/design.md`
- Implementation: `backend/src/config/auth.config.ts`
