/**
 * Factory functions for mock API responses.
 * All factories return plain objects matching backend response shapes.
 */

interface MockUser {
  id: number;
  email: string;
  name: string;
  status: string;
}

interface MockProject {
  id: number;
  name: string;
  slug: string;
  roles: string[];
}

interface MockLoginResponseOptions {
  user?: Partial<MockUser>;
  selectedProjectId?: number;
}

export function mockLoginResponse(options: MockLoginResponseOptions = {}) {
  return {
    user: {
      id: 1,
      email: 'admin@hashhive.local',
      name: 'Admin User',
      status: 'active',
      ...options.user,
    },
    ...(options.selectedProjectId !== undefined
      ? { selectedProjectId: options.selectedProjectId }
      : {}),
  };
}

interface MockMeResponseOptions {
  user?: Partial<MockUser>;
  projectCount?: number;
  projects?: MockProject[];
  selectedProjectId?: number;
}

export function mockMeResponse(options: MockMeResponseOptions = {}) {
  const projectCount = options.projectCount ?? 2;
  const projects =
    options.projects ??
    Array.from({ length: projectCount }, (_, i) => ({
      id: i + 1,
      name: `Project ${i + 1}`,
      slug: `project-${i + 1}`,
      roles: ['admin'],
    }));

  return {
    user: {
      id: 1,
      email: 'admin@hashhive.local',
      name: 'Admin User',
      projects: projects.map((p) => ({
        projectId: p.id,
        projectName: p.name,
        roles: p.roles,
      })),
      ...options.user,
    },
    projects,
    ...(options.selectedProjectId !== undefined
      ? { selectedProjectId: options.selectedProjectId }
      : {}),
  };
}

interface MockDashboardStatsOptions {
  agents?: Partial<{ total: number; online: number; offline: number; error: number }>;
  campaigns?: Partial<{
    total: number;
    draft: number;
    running: number;
    paused: number;
    completed: number;
  }>;
  tasks?: Partial<{
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  }>;
  cracked?: Partial<{ total: number }>;
}

export function mockDashboardStats(options: MockDashboardStatsOptions = {}) {
  return {
    agents: {
      total: 5,
      online: 3,
      offline: 2,
      error: 0,
      ...options.agents,
    },
    campaigns: {
      total: 10,
      draft: 2,
      running: 3,
      paused: 1,
      completed: 4,
      ...options.campaigns,
    },
    tasks: {
      total: 50,
      pending: 10,
      running: 15,
      completed: 20,
      failed: 5,
      ...options.tasks,
    },
    cracked: {
      total: 42,
      ...options.cracked,
    },
  };
}

interface MockProjectsResponseOptions {
  count?: number;
  projects?: Array<Partial<MockProject>>;
}

export function mockProjectsResponse(options: MockProjectsResponseOptions = {}) {
  const count = options.count ?? 2;
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Project ${i + 1}`,
    slug: `project-${i + 1}`,
    roles: ['admin'],
    ...options.projects?.[i],
  }));
}
