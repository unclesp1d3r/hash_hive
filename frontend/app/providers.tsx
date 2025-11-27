'use client';

import { SessionProvider } from '../lib/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * Wraps application children with authentication and React Query providers.
 *
 * Lazily creates a single QueryClient configured with a 60,000 ms staleTime and
 * with `refetchOnWindowFocus` disabled, then renders `SessionProvider` and
 * `QueryClientProvider` around the provided children.
 *
 * @returns A React element that renders `children` inside `SessionProvider` and `QueryClientProvider`.
 */
export function Providers({ children }: { children: React.ReactNode }): React.ReactElement {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers -- 60 seconds * 1000 ms = 1 minute
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <SessionProvider basePath="/auth">
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}