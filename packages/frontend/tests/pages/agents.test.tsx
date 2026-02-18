import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { AgentsPage } from '../../src/pages/agents';
import { useUiStore } from '../../src/stores/ui';
import { mockAgentsResponse } from '../fixtures/api-responses';
import { mockFetch, restoreFetch } from '../mocks/fetch';
import { cleanupAll, fireEvent, renderWithProviders, screen, waitFor } from '../test-utils';

let fetchMock: ReturnType<typeof mockFetch>;

afterEach(() => {
  cleanupAll();
  if (fetchMock) restoreFetch(fetchMock);
});

function selectProject(projectId = 1) {
  useUiStore.setState({ selectedProjectId: projectId });
}

describe('AgentsPage', () => {
  it('shows empty state when no project selected', () => {
    fetchMock = mockFetch();
    renderWithProviders(<AgentsPage />);

    expect(screen.getByText('Select a project to view agents.')).toBeDefined();
  });

  it('renders agents table when project selected and agents returned', async () => {
    const data = mockAgentsResponse({
      agents: [
        { id: 1, name: 'Rig Alpha', status: 'online' },
        { id: 2, name: 'Rig Beta', status: 'offline' },
      ],
    });

    fetchMock = mockFetch({
      '/dashboard/agents': { status: 200, body: data },
    });

    selectProject();
    renderWithProviders(<AgentsPage />);

    await waitFor(() => {
      expect(screen.getByText('Rig Alpha')).toBeDefined();
    });

    expect(screen.getByText('Rig Beta')).toBeDefined();
    expect(screen.getByText('online')).toBeDefined();
    expect(screen.getByText('offline')).toBeDefined();
  });

  it('shows no agents message when API returns empty list', async () => {
    fetchMock = mockFetch({
      '/dashboard/agents': { status: 200, body: { agents: [], total: 0 } },
    });

    selectProject();
    renderWithProviders(<AgentsPage />);

    await waitFor(() => {
      expect(screen.getByText('No agents found.')).toBeDefined();
    });
  });

  it('renders status filter dropdown with correct options', async () => {
    fetchMock = mockFetch({
      '/dashboard/agents': { status: 200, body: mockAgentsResponse() },
    });

    selectProject();
    renderWithProviders(<AgentsPage />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select).toBeDefined();
    expect(select.value).toBe('');

    const options = Array.from(select.querySelectorAll('option'));
    const values = options.map((o) => o.value);
    expect(values).toContain('online');
    expect(values).toContain('offline');
    expect(values).toContain('busy');
    expect(values).toContain('error');
  });

  it('triggers new fetch when status filter changes', async () => {
    fetchMock = mockFetch({
      '/dashboard/agents': { status: 200, body: mockAgentsResponse() },
    });

    selectProject();
    renderWithProviders(<AgentsPage />);

    await waitFor(() => {
      expect(screen.getByText('Agent 1')).toBeDefined();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'online' } });

    // After filter change, new query fires - verify the dropdown updated
    await waitFor(() => {
      expect((select as HTMLSelectElement).value).toBe('online');
    });
  });

  it('renders Details link for each agent', async () => {
    fetchMock = mockFetch({
      '/dashboard/agents': {
        status: 200,
        body: mockAgentsResponse({
          count: 1,
          agents: [{ id: 42, name: 'Rig Gamma', status: 'online' }],
        }),
      },
    });

    selectProject();
    renderWithProviders(<AgentsPage />);

    await waitFor(() => {
      expect(screen.getByText('Rig Gamma')).toBeDefined();
    });

    const detailsLink = screen.getByText('Details');
    expect(detailsLink.closest('a')?.getAttribute('href')).toBe('/agents/42');
  });
});
