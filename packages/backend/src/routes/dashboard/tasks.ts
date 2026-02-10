import { Hono } from 'hono';
import { requireSession } from '../../middleware/auth.js';
import { getTaskById, listTasks } from '../../services/tasks.js';
import type { AppEnv } from '../../types.js';

const taskRoutes = new Hono<AppEnv>();

taskRoutes.use('*', requireSession);

// ─── GET / — list tasks with filtering ──────────────────────────────

taskRoutes.get('/', async (c) => {
  const campaignId = c.req.query('campaignId') ? Number(c.req.query('campaignId')) : undefined;
  const attackId = c.req.query('attackId') ? Number(c.req.query('attackId')) : undefined;
  const agentId = c.req.query('agentId') ? Number(c.req.query('agentId')) : undefined;
  const status = c.req.query('status') ?? undefined;
  const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined;
  const offset = c.req.query('offset') ? Number(c.req.query('offset')) : undefined;

  const result = await listTasks({ campaignId, attackId, agentId, status, limit, offset });
  return c.json(result);
});

// ─── GET /:id — get task details ────────────────────────────────────

taskRoutes.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const task = await getTaskById(id);

  if (!task) {
    return c.json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Task not found' } }, 404);
  }

  return c.json({ task });
});

export { taskRoutes };
