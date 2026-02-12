import { afterEach, describe, expect, it } from 'bun:test';
import { cleanup, screen } from '@testing-library/react';
import { StatCard } from '../../src/components/features/stat-card';
import { renderWithProviders } from '../test-utils';

afterEach(cleanup);

describe('StatCard', () => {
  it('should render title, value, and subtitle', () => {
    renderWithProviders(<StatCard title="Agents" value={7} subtitle="3 online" />);
    expect(screen.getByText('Agents')).toBeDefined();
    expect(screen.getByText('7')).toBeDefined();
    expect(screen.getByText('3 online')).toBeDefined();
  });

  it('should show placeholder when loading', () => {
    renderWithProviders(<StatCard title="Agents" value={7} subtitle="3 online" loading />);
    expect(screen.getByText('--')).toBeDefined();
    expect(screen.queryByText('7')).toBeNull();
  });

  it('should render string values', () => {
    renderWithProviders(<StatCard title="Status" value="Active" subtitle="All systems go" />);
    expect(screen.getByText('Active')).toBeDefined();
  });
});
