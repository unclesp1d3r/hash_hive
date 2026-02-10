import { logger } from '../config/logger.js';

// ─── Event Types ────────────────────────────────────────────────────

export type EventType =
  | 'agent_status'
  | 'campaign_status'
  | 'task_update'
  | 'crack_result'
  | 'resource_update';

export interface AppEvent {
  type: EventType;
  projectId: number;
  data: Record<string, unknown>;
  timestamp: string;
}

// ─── Connection Registry ────────────────────────────────────────────

interface WebSocketClient {
  ws: { send: (data: string) => void; readyState: number };
  projectIds: Set<number>;
  subscribedTypes: Set<EventType>;
}

const ALL_EVENT_TYPES: EventType[] = [
  'agent_status',
  'campaign_status',
  'task_update',
  'crack_result',
  'resource_update',
];

let clientIdCounter = 0;
const clients = new Map<number, WebSocketClient>();

export function registerClient(
  ws: WebSocketClient['ws'],
  projectIds: number[],
  eventTypes?: EventType[]
): number {
  const id = ++clientIdCounter;
  clients.set(id, {
    ws,
    projectIds: new Set(projectIds),
    subscribedTypes: new Set(eventTypes ?? ALL_EVENT_TYPES),
  });
  logger.debug({ clientId: id, projectIds, eventTypes }, 'WebSocket client registered');
  return id;
}

export function unregisterClient(clientId: number) {
  clients.delete(clientId);
  logger.debug({ clientId }, 'WebSocket client unregistered');
}

export function getClientCount(): number {
  return clients.size;
}

// ─── Event Broadcasting ─────────────────────────────────────────────

// Throttle: track last emit time per event type + project
const lastEmitTimes = new Map<string, number>();
const THROTTLE_MS = 250; // Max 4 events/sec per type+project

/**
 * Emits an event to all connected clients that are subscribed
 * to the event's project and type. Applies per-type throttling.
 */
export function emit(event: AppEvent) {
  const throttleKey = `${event.type}:${event.projectId}`;
  const now = Date.now();
  const lastEmit = lastEmitTimes.get(throttleKey) ?? 0;

  if (now - lastEmit < THROTTLE_MS) {
    return; // Throttled
  }
  lastEmitTimes.set(throttleKey, now);

  const payload = JSON.stringify(event);
  let delivered = 0;

  for (const [clientId, client] of clients) {
    // Check project scope
    if (!client.projectIds.has(event.projectId)) {
      continue;
    }

    // Check event type subscription
    if (!client.subscribedTypes.has(event.type)) {
      continue;
    }

    // Check connection is open (WebSocket OPEN = 1)
    if (client.ws.readyState !== 1) {
      clients.delete(clientId);
      continue;
    }

    try {
      client.ws.send(payload);
      delivered++;
    } catch {
      clients.delete(clientId);
    }
  }

  if (delivered > 0) {
    logger.debug({ type: event.type, projectId: event.projectId, delivered }, 'event broadcasted');
  }
}

// ─── Convenience Emitters ───────────────────────────────────────────

export function emitAgentStatus(projectId: number, agentId: number, status: string) {
  emit({
    type: 'agent_status',
    projectId,
    data: { agentId, status },
    timestamp: new Date().toISOString(),
  });
}

export function emitCampaignStatus(projectId: number, campaignId: number, status: string) {
  emit({
    type: 'campaign_status',
    projectId,
    data: { campaignId, status },
    timestamp: new Date().toISOString(),
  });
}

export function emitTaskUpdate(
  projectId: number,
  taskId: number,
  status: string,
  progress?: Record<string, unknown>
) {
  emit({
    type: 'task_update',
    projectId,
    data: { taskId, status, ...(progress ? { progress } : {}) },
    timestamp: new Date().toISOString(),
  });
}

export function emitCrackResult(projectId: number, hashListId: number, count: number) {
  emit({
    type: 'crack_result',
    projectId,
    data: { hashListId, crackedCount: count },
    timestamp: new Date().toISOString(),
  });
}
