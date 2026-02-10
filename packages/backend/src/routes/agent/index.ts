import { agentHeartbeatSchema } from '@hashhive/shared';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireAgentToken } from '../../middleware/auth.js';
import { authenticateAgent, logAgentError, processHeartbeat } from '../../services/agents.js';
import { createToken } from '../../services/auth.js';
import { assignNextTask, handleTaskFailure, updateTaskProgress } from '../../services/tasks.js';
import type { AppEnv } from '../../types.js';

const agentRoutes = new Hono<AppEnv>();

// ─── POST /sessions — agent login with auth token ────────────────────

const sessionSchema = z.object({
  token: z.string().min(1),
});

agentRoutes.post('/sessions', zValidator('json', sessionSchema), async (c) => {
  const { token } = c.req.valid('json');
  const agent = await authenticateAgent(token);

  if (!agent) {
    return c.json(
      { error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid agent token' } },
      401
    );
  }

  const sessionToken = await createToken({
    userId: agent.id,
    email: `agent-${agent.id}@agents.local`,
    type: 'agent',
  });

  return c.json({
    sessionToken,
    config: {
      agentId: agent.id,
      projectId: agent.projectId,
    },
  });
});

// ─── Authenticated agent endpoints ──────────────────────────────────

agentRoutes.use('/heartbeat', requireAgentToken);
agentRoutes.use('/tasks/*', requireAgentToken);
agentRoutes.use('/errors', requireAgentToken);

// ─── POST /heartbeat — agent heartbeat ──────────────────────────────

agentRoutes.post('/heartbeat', zValidator('json', agentHeartbeatSchema), async (c) => {
  const { userId: agentId } = c.get('currentUser');
  const data = c.req.valid('json');
  await processHeartbeat(agentId, data);
  return c.json({ acknowledged: true });
});

// ─── POST /tasks/next — request next task ───────────────────────────

agentRoutes.post('/tasks/next', async (c) => {
  const { userId: agentId } = c.get('currentUser');
  const task = await assignNextTask(agentId);
  return c.json({ task });
});

// ─── POST /tasks/:id/report — report task progress ─────────────────

const taskReportSchema = z.object({
  status: z.enum(['running', 'completed', 'failed', 'exhausted']),
  progress: z
    .object({
      keyspaceProgress: z.number().optional(),
      speed: z.number().optional(),
      temperature: z.number().optional(),
    })
    .optional(),
  results: z
    .array(
      z.object({
        hashValue: z.string(),
        plaintext: z.string(),
      })
    )
    .optional(),
  errors: z.array(z.string()).optional(),
});

agentRoutes.post('/tasks/:id/report', zValidator('json', taskReportSchema), async (c) => {
  const { userId: agentId } = c.get('currentUser');
  const taskId = Number(c.req.param('id'));
  const data = c.req.valid('json');

  // Log any errors reported by the agent
  if (data.errors && data.errors.length > 0) {
    for (const errorMessage of data.errors) {
      await logAgentError({
        agentId,
        severity: 'error',
        message: errorMessage,
        taskId,
      });
    }
  }

  // Handle failure with retry logic
  if (data.status === 'failed') {
    const failResult = await handleTaskFailure(taskId, data.errors?.[0] ?? 'Unknown failure');
    return c.json({ acknowledged: true, retried: failResult.retried ?? false });
  }

  // Update task progress and insert cracked results
  const result = await updateTaskProgress(taskId, agentId, data);

  if ('error' in result) {
    return c.json({ error: { code: 'TASK_ERROR', message: result.error } }, 400);
  }

  return c.json({ acknowledged: true });
});

// ─── POST /errors — log an agent error ──────────────────────────────

const agentErrorSchema = z.object({
  severity: z.enum(['warning', 'error', 'fatal']),
  message: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  taskId: z.number().int().positive().optional(),
});

agentRoutes.post('/errors', zValidator('json', agentErrorSchema), async (c) => {
  const { userId: agentId } = c.get('currentUser');
  const data = c.req.valid('json');
  await logAgentError({ ...data, agentId });
  return c.json({ acknowledged: true });
});

export { agentRoutes };
