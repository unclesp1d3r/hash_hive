# Agent Authentication & Authorization

## Overview

Simplify agent authentication to use pre-shared tokens on every request, removing the JWT exchange mechanism to align with the validated architecture.

## Scope

**In Scope:**
- Simplify agent auth to use pre-shared token on every request (no JWT exchange)
- Remove `/agent/sessions` endpoint
- Update auth middleware to validate pre-shared tokens from `agents.auth_token` table
- Add agent context injection (`agent_id`, `project_id`) to request context
- Update OpenAPI spec (`file:openapi/agent-api.yaml`) to reflect token-based auth
- Update `file:packages/backend/src/middleware/auth.ts`

**Out of Scope:**
- Agent registration UI (manual provisioning for v1)
- Token rotation mechanism
- Token expiration

## Acceptance Criteria

1. **Pre-Shared Token Authentication**
   - Agents send `Authorization: Bearer <token>` header on every request
   - Middleware validates token against `agents.auth_token` column
   - No session/JWT exchange required
   - Token validation is fast (indexed query on `auth_token`)

2. **Middleware Updates**
   - Auth middleware extracts token from `Authorization` header
   - Queries `agents` table for matching `auth_token`
   - Injects agent context into request: `{ agentId, projectId, capabilities }`
   - Returns 401 if token is invalid or agent is inactive

3. **Endpoint Cleanup**
   - Remove `POST /api/v1/agent/sessions` endpoint
   - Remove session-related code from agent routes
   - Update agent route handlers to use injected agent context

4. **OpenAPI Spec Update**
   - Update `file:openapi/agent-api.yaml` to document Bearer token auth
   - Remove session-related endpoints from spec
   - Add security scheme for Bearer token

5. **Contract Tests**
   - Update agent API contract tests to use Bearer tokens
   - Verify 401 responses for invalid/missing tokens
   - Verify agent context is correctly injected

## Technical Notes

**Current Implementation:**
- `file:packages/backend/src/routes/agent/index.ts` has `/agent/sessions` endpoint
- Need to remove this and simplify to direct token validation

**Auth Middleware Pattern:**
```typescript
// Simplified agent auth middleware
export const agentAuth = async (c: Context, next: Next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return c.json({ error: 'Missing token' }, 401);

  const agent = await db.query.agents.findFirst({
    where: eq(agents.authToken, token),
  });

  if (!agent || agent.status !== 'active') {
    return c.json({ error: 'Invalid token' }, 401);
  }

  c.set('agent', { agentId: agent.id, projectId: agent.projectId });
  await next();
};
```

**OpenAPI Security Scheme:**
```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      description: Pre-shared agent token
```

## Dependencies

None (can run in parallel with foundation tickets)

## Spec References

- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/9332598a-b507-42ee-8e71-6a8e43712c16` (Tech Plan → Dual API Surface Design)
- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/9332598a-b507-42ee-8e71-6a8e43712c16` (Tech Plan → Agent authentication decision)
