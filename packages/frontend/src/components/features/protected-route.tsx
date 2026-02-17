import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '../../stores/auth';
import { useUiStore } from '../../stores/ui';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { selectedProjectId } = useUiStore();

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

  if (!selectedProjectId) {
    return <Navigate to="/select-project" replace />;
  }

  return <Outlet />;
}
