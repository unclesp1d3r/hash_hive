import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { useEvents, type EventType } from '../../src/hooks/use-events';
import { useAuthStore } from '../../src/stores/auth';
import { useUiStore } from '../../src/stores/ui';
import { installMockWebSocket } from '../mocks/websocket';
import { cleanupAll, createTestQueryClient, screen, waitFor } from '../test-utils';

let wsMock: ReturnType<typeof installMockWebSocket>;

function setAuthenticatedWithProject(projectId = 1) {
  useAuthStore.setState({
    isAuthenticated: true,
    isLoading: false,
    user: {
      id: 1,
      email: 'admin@hashhive.local',
      name: 'Admin',
      projects: [{ projectId, projectName: 'Project 1', roles: ['admin'] }],
    },
  });
  useUiStore.setState({ selectedProjectId: projectId });
}

interface EventsState {
  connected: boolean;
  polling: boolean;
}

/**
 * Test component that renders the useEvents hook state.
 */
function EventsTestComponent({
  types,
  onEvent,
}: {
  types?: EventType[];
  onEvent?: (e: unknown) => void;
}) {
  const { connected, polling } = useEvents({ types, onEvent });
  return (
    <div>
      <span data-testid="connected">{String(connected)}</span>
      <span data-testid="polling">{String(polling)}</span>
    </div>
  );
}

function renderEventsHook(
  qc?: QueryClient,
  hookProps?: { types?: EventType[]; onEvent?: (e: unknown) => void }
) {
  const queryClient = qc ?? createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <EventsTestComponent types={hookProps?.types} onEvent={hookProps?.onEvent} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  wsMock = installMockWebSocket();
});

afterEach(() => {
  cleanupAll();
  wsMock.restore();
});

describe('useEvents', () => {
  it('connects to WebSocket on mount', async () => {
    setAuthenticatedWithProject(1);
    renderEventsHook();

    // WebSocket constructor should have been called
    expect(wsMock.constructorMock).toHaveBeenCalled();
    const ws = wsMock.instances[0]!;
    expect(ws.url).toContain('/api/v1/dashboard/events/stream');
    expect(ws.url).toContain('projectIds=1');

    ws.simulateOpen();

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('true');
    });
  });

  it('sets polling mode on WebSocket close', async () => {
    setAuthenticatedWithProject(1);
    renderEventsHook();

    const ws = wsMock.instances[0]!;
    ws.simulateOpen();

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('true');
    });

    // Simulate close — should trigger polling mode
    ws.simulateClose();

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('false');
      expect(screen.getByTestId('polling').textContent).toBe('true');
    });
  });

  it('invalidates dashboard-stats on crack_result event', async () => {
    setAuthenticatedWithProject(1);
    const qc = createTestQueryClient();
    const invalidateSpy = mock(() => Promise.resolve());
    const originalInvalidate = qc.invalidateQueries.bind(qc);
    qc.invalidateQueries = ((...args: Parameters<typeof qc.invalidateQueries>) => {
      invalidateSpy(...args);
      return originalInvalidate(...args);
    }) as typeof qc.invalidateQueries;

    renderEventsHook(qc);

    const ws = wsMock.instances[0]!;
    ws.simulateOpen();

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('true');
    });

    ws.simulateMessage({
      type: 'crack_result',
      projectId: 1,
      data: {},
      timestamp: new Date().toISOString(),
    });

    await waitFor(() => {
      const calls = invalidateSpy.mock.calls;
      const queryKeys = calls.map((c: unknown[]) => (c[0] as { queryKey: unknown[] }).queryKey);
      expect(queryKeys.some((k: unknown[]) => k[0] === 'dashboard-stats' && k[1] === 1)).toBe(true);
      expect(queryKeys.some((k: unknown[]) => k[0] === 'results' && k[1] === 1)).toBe(true);
    });
  });

  it('invalidates agents on agent_status event', async () => {
    setAuthenticatedWithProject(1);
    const qc = createTestQueryClient();
    const invalidateSpy = mock(() => Promise.resolve());
    const originalInvalidate = qc.invalidateQueries.bind(qc);
    qc.invalidateQueries = ((...args: Parameters<typeof qc.invalidateQueries>) => {
      invalidateSpy(...args);
      return originalInvalidate(...args);
    }) as typeof qc.invalidateQueries;

    renderEventsHook(qc);

    const ws = wsMock.instances[0]!;
    ws.simulateOpen();

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('true');
    });

    ws.simulateMessage({
      type: 'agent_status',
      projectId: 1,
      data: {},
      timestamp: new Date().toISOString(),
    });

    await waitFor(() => {
      const calls = invalidateSpy.mock.calls;
      const queryKeys = calls.map((c: unknown[]) => (c[0] as { queryKey: unknown[] }).queryKey);
      expect(queryKeys.some((k: unknown[]) => k[0] === 'agents' && k[1] === 1)).toBe(true);
      expect(queryKeys.some((k: unknown[]) => k[0] === 'dashboard-stats' && k[1] === 1)).toBe(true);
    });
  });

  it('reconnects with exponential backoff after disconnect', async () => {
    setAuthenticatedWithProject(1);
    renderEventsHook();

    const ws1 = wsMock.instances[0]!;
    ws1.simulateOpen();

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('true');
    });

    // Close triggers reconnect with 1s delay (2^0 * 1000)
    ws1.simulateClose();

    // Wait for reconnect timer (1 second)
    await new Promise((r) => setTimeout(r, 1100));

    // Should have created a second WebSocket instance
    expect(wsMock.instances.length).toBeGreaterThanOrEqual(2);

    const ws2 = wsMock.instances[1]!;
    ws2.simulateOpen();
    ws2.simulateClose();

    // Second reconnect should be 2s delay (2^1 * 1000)
    await new Promise((r) => setTimeout(r, 2100));

    expect(wsMock.instances.length).toBeGreaterThanOrEqual(3);
  });

  it('cleans up WebSocket on unmount', async () => {
    setAuthenticatedWithProject(1);
    const { unmount } = renderEventsHook();

    const ws = wsMock.instances[0]!;
    ws.simulateOpen();

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('true');
    });

    unmount();

    // The hook nulls onclose before calling close() to prevent reconnect
    expect(ws.readyState).toBe(ws.CLOSED);
  });

  it('filters events by type when types option provided', () => {
    setAuthenticatedWithProject(1);
    renderEventsHook(undefined, { types: ['crack_result'] });

    const ws = wsMock.instances[0]!;
    expect(ws.url).toContain('types=crack_result');
  });
});
