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
 * Extracts the user's role names from a session object.
 *
 * @param session - Session data returned by `useSession`
 * @returns An array of role names from `session.user.roles`; an empty array if there is no user or no roles
 */
function getUserRoles(session: ReturnType<typeof useSession>['data']): string[] {
  const user = session?.user;
  if (user === null || user === undefined) {
    return [];
  }
  return (user as { roles?: string[] }).roles ?? [];
}

/**
 * Determine if a user's roles satisfy an optional required role.
 *
 * @param userRoles - Array of role names assigned to the user.
 * @param requiredRole - Role required for access; if `null`, `undefined`, or an empty string, no role is required.
 * @returns `true` if `requiredRole` is not provided or is present in `userRoles`, `false` otherwise.
 */
function checkRoleAccess(userRoles: string[], requiredRole: string | undefined): boolean {
  if (requiredRole === null || requiredRole === undefined || requiredRole === '') {
    return true;
  }
  return userRoles.includes(requiredRole);
}

/**
 * Guards rendering behind authentication and optional role-based authorization, redirecting when access is denied.
 *
 * @param children - React nodes to render when access is granted.
 * @param requiredRole - Optional role name required to view the children; if omitted, no role check is performed.
 * @param redirectTo - URL to navigate to when the user is unauthenticated (default '/login').
 * @returns The rendered children when the user is authenticated and authorized, or `null` while redirecting or unauthorized.
 */
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
