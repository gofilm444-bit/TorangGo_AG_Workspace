import React, { useState } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createAppQueryClient } from './query-client.js';

export interface QueryProviderProps {
  children: React.ReactNode;
  client?: QueryClient;
}

export function QueryProvider({ children, client }: QueryProviderProps) {
  // Lazily initialize query client per component tree if not provided externally
  const [queryClient] = useState(() => client ?? createAppQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
