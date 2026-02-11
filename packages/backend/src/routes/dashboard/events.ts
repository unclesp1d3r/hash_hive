import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import { getCookie } from 'hono/cookie';
import { validateToken } from '../../services/auth.js';
import type { EventType } from '../../services/events.js';
import { getClientCount, registerClient, unregisterClient } from '../../services/events.js';
import type { AppEnv } from '../../types.js';

const { upgradeWebSocket } = createBunWebSocket();

const eventRoutes = new Hono<AppEnv>();

// ─── GET /stream — WebSocket upgrade for real-time events ───────────

eventRoutes.get(
  '/stream',
  upgradeWebSocket((c) => {
    let clientId: number | null = null;

    return {
      async onOpen(_event, ws) {
        // Hybrid auth: try cookie first, fall back to query token
        let payload: Awaited<ReturnType<typeof validateToken>> = null;

        const cookieToken = getCookie(c, 'session');
        if (cookieToken) {
          payload = await validateToken(cookieToken);
        }

        if (!payload) {
          const queryToken = c.req.query('token');
          if (queryToken) {
            payload = await validateToken(queryToken);
          }
        }

        if (!payload || payload.type !== 'session') {
          ws.close(4001, 'Missing authentication (cookie or token required)');
          return;
        }

        // Parse subscriptions from query
        const projectIdsParam = c.req.query('projectIds');
        const projectIds = projectIdsParam
          ? projectIdsParam.split(',').map(Number).filter(Boolean)
          : [];

        if (projectIds.length === 0) {
          ws.close(4002, 'At least one projectId is required');
          return;
        }

        const typesParam = c.req.query('types');
        const eventTypes = typesParam ? (typesParam.split(',') as EventType[]) : undefined;

        // Register this WebSocket as a client
        const rawWs = ws.raw as { send: (data: string) => void; readyState: number };
        clientId = registerClient(rawWs, projectIds, eventTypes);

        ws.send(
          JSON.stringify({
            type: 'connected',
            clientId,
            projectIds,
            eventTypes: eventTypes ?? 'all',
          })
        );
      },

      onMessage(_event, ws) {
        // Clients don't send messages in this protocol; could be used for ping/pong
        ws.send(JSON.stringify({ type: 'pong' }));
      },

      onClose() {
        if (clientId !== null) {
          unregisterClient(clientId);
        }
      },
    };
  })
);

// ─── GET /status — check event system health ────────────────────────

eventRoutes.get('/status', (c) => {
  return c.json({
    connectedClients: getClientCount(),
    timestamp: new Date().toISOString(),
  });
});

export { eventRoutes };
