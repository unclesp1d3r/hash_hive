import { useState } from 'react';
import { Navigate } from 'react-router';
import { useAuthStore } from '../stores/auth';
import { useUiStore } from '../stores/ui';

export function SelectProjectPage() {
  const { user, isAuthenticated, isLoading, selectProject } = useAuthStore();
  const { selectedProjectId, setSelectedProject } = useUiStore();
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (selectedProjectId) {
    return <Navigate to="/" replace />;
  }

  const projects = user?.projects ?? [];

  const handleSelect = async (projectId: number) => {
    setSelecting(true);
    setError(null);
    try {
      await selectProject(projectId);
      setSelectedProject(projectId);
    } catch {
      setError('Failed to select project. Please try again.');
    } finally {
      setSelecting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Select Project</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose a project to continue</p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        {projects.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No projects available. Contact an administrator.
          </p>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <button
                key={project.projectId}
                type="button"
                disabled={selecting}
                onClick={() => handleSelect(project.projectId)}
                className="w-full rounded-md border bg-background px-4 py-3 text-left transition-colors hover:bg-accent disabled:opacity-50"
              >
                <div className="font-medium">{project.projectName}</div>
                <div className="text-xs text-muted-foreground">
                  Roles: {project.roles.join(', ')}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
