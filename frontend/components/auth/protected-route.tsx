'use client';

import { useSession } from '../../lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

/**
 * Protected route component using Auth.js useSession
 * Redirects to login if unauthenticated
 * Optionally checks for required role
 */
export function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps): React.ReactElement | null {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated' && requiredRole) {
      const userRoles = session?.user?.roles ?? [];
      if (!userRoles.includes(requiredRole)) {
        router.push('/unauthorized');
        return;
      }
    }
  }, [status, session, router, requiredRole]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  if (requiredRole && session?.user?.roles && !session.user.roles.includes(requiredRole)) {
    return null;
  }

  return <>{children}</>;
}
