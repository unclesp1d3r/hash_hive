'use client';

import { useSession } from '../../lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  redirectTo?: string;
}

/**
 * Protected route component using Auth.js useSession
 * Redirects to login if unauthenticated
 * Optionally checks for required role
 */
function getUserRoles(session: ReturnType<typeof useSession>['data']): string[] {
  const user = session?.user;
  if (user === null || user === undefined) {
    return [];
  }
  return (user as { roles?: string[] }).roles ?? [];
}

function checkRoleAccess(userRoles: string[], requiredRole: string | undefined): boolean {
  if (requiredRole === null || requiredRole === undefined || requiredRole === '') {
    return true;
  }
  return userRoles.includes(requiredRole);
}

export function ProtectedRoute({
  children,
  requiredRole,
  redirectTo = '/login',
}: ProtectedRouteProps): React.ReactElement | null {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(redirectTo);
      return;
    }

    if (status === 'authenticated') {
      const userRoles = getUserRoles(session);
      if (!checkRoleAccess(userRoles, requiredRole)) {
        router.push('/unauthorized');
      }
    }
  }, [status, session, requiredRole, router, redirectTo]);

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render children if unauthenticated (redirect will happen)
  if (status === 'unauthenticated') {
    return null;
  }

  // Check role if required
  if (status === 'authenticated') {
    const userRoles = getUserRoles(session);
    if (!checkRoleAccess(userRoles, requiredRole)) {
      return null; // Redirect will happen in useEffect
    }
  }

  // Render children if authenticated (and role check passed if required)
  return <>{children}</>;
}
