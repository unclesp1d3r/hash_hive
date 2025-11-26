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

    if (status === 'authenticated' && requiredRole) {
      const userRoles = (session?.user as { roles?: string[] })?.roles ?? [];
      if (!userRoles.includes(requiredRole)) {
        router.push('/unauthorized');
        return;
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
  if (requiredRole && status === 'authenticated') {
    const userRoles = (session?.user as { roles?: string[] })?.roles ?? [];
    if (!userRoles.includes(requiredRole)) {
      return null; // Redirect will happen in useEffect
    }
  }

  // Render children if authenticated (and role check passed if required)
  return <>{children}</>;
}
