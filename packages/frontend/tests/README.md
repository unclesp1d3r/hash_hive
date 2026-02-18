# Frontend Testing Guide

## Stack

- **Test runner**: bun:test (Bun's built-in runner)
- **DOM library**: Testing Library (`@testing-library/react`)
- **DOM environment**: happy-dom (injected via `tests/setup.ts`)
- **User events**: `@testing-library/user-event`

## Directory Layout

```
tests/
├── setup.ts              # happy-dom global injection (--preload)
├── test-utils.tsx         # Provider wrappers and render helpers
├── README.md              # This file
├── components/            # Component unit tests
├── pages/                 # Page integration tests (routing, API)
├── hooks/                 # Custom hook tests
├── stores/                # Zustand store tests
├── mocks/                 # Mock utilities
│   ├── fetch.ts           # Global fetch mock
│   └── websocket.ts       # Global WebSocket mock
├── fixtures/              # Test data factories
│   └── api-responses.ts   # Mock API response factories
└── utils/                 # Test helpers
    └── store-reset.ts     # Zustand store reset utilities
```

## Running Tests

```bash
# All frontend tests
bun --filter frontend test

# Specific test file
bun test --preload ./tests/setup.ts tests/pages/login.test.tsx

# Repeat for stability check
bun --filter frontend test --repeat 3
```

## Patterns

### Render With Providers

Use `renderWithProviders()` for components that need QueryClient and Router:

```tsx
import { renderWithProviders, screen } from '../test-utils';

renderWithProviders(<MyComponent />);
expect(screen.getByText('Hello')).toBeDefined();
```

### Render With Router (Navigation Tests)

Use `renderWithRouter()` when testing redirects and navigation:

```tsx
import { renderWithRouter, screen } from '../test-utils';

renderWithRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/select-project', element: <div>Select Project</div> },
  { path: '/', element: <div>Dashboard</div> },
], { initialRoute: '/login' });
```

### API Mocking

Use `mockFetch()` to intercept global `fetch` calls:

```tsx
import { mockFetch, restoreFetch } from '../mocks/fetch';
import { mockDashboardStats } from '../fixtures/api-responses';

let fetchMock: ReturnType<typeof mockFetch>;

beforeEach(() => {
  fetchMock = mockFetch({
    '/dashboard/stats': { status: 200, body: mockDashboardStats() },
  });
});

afterEach(() => {
  restoreFetch(fetchMock);
});
```

### Store Reset

Always reset Zustand stores in `afterEach` to prevent cross-test pollution:

```tsx
import { cleanupAll } from '../test-utils';

afterEach(cleanupAll);
```

Or manually:

```tsx
import { cleanup } from '@testing-library/react';
import { resetAllStores } from '../utils/store-reset';

afterEach(() => {
  cleanup();
  resetAllStores();
});
```

### WebSocket Mocking

Use `installMockWebSocket()` for real-time event tests:

```tsx
import { installMockWebSocket } from '../mocks/websocket';

let wsMock: ReturnType<typeof installMockWebSocket>;

beforeEach(() => {
  wsMock = installMockWebSocket();
});

afterEach(() => {
  wsMock.restore();
});

it('receives events', () => {
  // ... render component that creates WebSocket ...
  const ws = wsMock.instances[0];
  ws.simulateOpen();
  ws.simulateMessage({ type: 'crack_result', projectId: 1, data: {} });
});
```

### Timer Control

Use Bun's fake timers for polling/reconnect tests:

```tsx
import { useFakeTimers, useRealTimers } from 'bun:test';

beforeEach(() => useFakeTimers());
afterEach(() => useRealTimers());

it('reconnects with backoff', () => {
  // ... trigger disconnect ...
  advanceTimersByTime(1000); // First reconnect
  advanceTimersByTime(2000); // Second reconnect (exponential)
});
```

### Setting Store State for Tests

Pre-set Zustand store state before rendering:

```tsx
import { useAuthStore } from '../../src/stores/auth';
import { useUiStore } from '../../src/stores/ui';

useAuthStore.setState({
  user: { id: 1, email: 'admin@hashhive.local', name: 'Admin', projects: [] },
  isAuthenticated: true,
  isLoading: false,
});

useUiStore.setState({ selectedProjectId: 1 });
```
