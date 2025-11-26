'use client';

import { SessionProvider } from '../lib/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * Providers wrapper for Next.js app
 * Includes Auth.js SessionProvider and React Query QueryClientProvider
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
    <SessionProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}

