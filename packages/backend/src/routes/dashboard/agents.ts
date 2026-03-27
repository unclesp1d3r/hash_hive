import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireSession } from '../../middleware/auth.js';
import { requireProjectAccess, requireRole } from '../../middleware/rbac.js';
import {
  getAgentById,
  getAgentErrors,
  getBenchmarksForAgent,
  listAgents,
  updateAgent,
} from '../../services/agents.js';
import type { AppEnv } from '../../types.js';

const dashboardAgentRoutes = new Hono<AppEnv>();

dashboardAgentRoutes.use('*', requireSession);

// GET /agents — list agents with optional filtering
dashboardAgentRoutes.get('/', requireProjectAccess(), async (c) => {
  const { projectId } = c.get('currentUser');
  const status = c.req.query('status') ?? undefined;
  const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined;
  const offset = c.req.query('offset') ? Number(c.req.query('offset')) : undefined;

  const result = await listAgents({ projectId: projectId ?? undefined, status, limit, offset });
  return c.json(result);
});

// GET /agents/:id -- get agent details
dashboardAgentRoutes.get('/:id', requireProjectAccess(), async (c) => {
  const agentId = Number(c.req.param('id'));
  if (Number.isNaN(agentId) || agentId <= 0) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid agent ID' } }, 400);
  }
  const { projectId } = c.get('currentUser');
  const agent = await getAgentById(agentId);

  if (!agent || agent.projectId !== projectId) {
    return c.json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Agent not found' } }, 404);
  }

  return c.json({ agent });
});

// PATCH /agents/:id — update agent
const updateAgentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.enum(['online', 'offline', 'busy', 'error']).optional(),
});

dashboardAgentRoutes.patch(
  '/:id',
  requireRole('admin', 'contributor'),
  zValidator('json', updateAgentSchema),
  async (c) => {
    const agentId = Number(c.req.param('id'));
    const data = c.req.valid('json');
    const agent = await updateAgent(agentId, data);

    if (!agent) {
      return c.json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Agent not found' } }, 404);
    }

    return c.json({ agent });
  }
);

// GET /agents/:id/errors -- get agent errors
dashboardAgentRoutes.get('/:id/errors', requireProjectAccess(), async (c) => {
  const agentId = Number(c.req.param('id'));
  if (Number.isNaN(agentId) || agentId <= 0) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid agent ID' } }, 400);
  }
  const { projectId } = c.get('currentUser');

  const agent = await getAgentById(agentId);
  if (!agent || agent.projectId !== projectId) {
    return c.json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Agent not found' } }, 404);
  }

  const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined;
  const offset = c.req.query('offset') ? Number(c.req.query('offset')) : undefined;

  const errors = await getAgentErrors(agentId, { limit, offset });
  return c.json({ errors });
});

// GET /agents/:id/benchmarks -- get agent benchmarks
dashboardAgentRoutes.get('/:id/benchmarks', requireProjectAccess(), async (c) => {
  const agentId = Number(c.req.param('id'));
  if (Number.isNaN(agentId) || agentId <= 0) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid agent ID' } }, 400);
  }
  const { projectId } = c.get('currentUser');

  const agent = await getAgentById(agentId);
  if (!agent || agent.projectId !== projectId) {
    return c.json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Agent not found' } }, 404);
  }

  const benchmarks = await getBenchmarksForAgent(agentId);
  return c.json({ benchmarks });
});

export { dashboardAgentRoutes };
