import { Link, useLocation } from 'react-router';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/auth';
import { useUiStore } from '../../stores/ui';

const navItems = [
  { label: 'Dashboard', href: '/', icon: 'grid' },
  { label: 'Campaigns', href: '/campaigns', icon: 'target' },
  { label: 'Agents', href: '/agents', icon: 'cpu' },
  { label: 'Resources', href: '/resources', icon: 'database' },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const { user, logout } = useAuthStore();
  const { sidebarOpen, selectedProjectId, setSelectedProject } = useUiStore();

  if (!sidebarOpen) return null;

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="border-b p-4">
        <h1 className="text-lg font-bold">HashHive</h1>
      </div>

      {user && user.projects.length > 0 && (
        <div className="border-b p-4">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="project-select">
            Project
          </label>
          <select
            id="project-select"
            className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
            value={selectedProjectId ?? ''}
            onChange={(e) => setSelectedProject(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">All Projects</option>
            {user.projects.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.projectName}
              </option>
            ))}
          </select>
        </div>
      )}

      <nav className="flex-1 p-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
              pathname === item.href
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => logout()}
          >
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
