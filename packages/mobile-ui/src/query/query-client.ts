import { QueryClient } from '@tanstack/react-query';

/**
 * Creates a configured QueryClient instance with production-safe defaults for mobile apps:
 * - 1 retry on network failures
 * - 2 minutes staleTime
 * - 10 minutes gcTime
 * - No automatic retry on mutations
 * - Window focus refetch disabled (suited for React Native lifecycle)
 */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 1000 * 60 * 2, // 2 minutes
        gcTime: 1000 * 60 * 10,   // 10 minutes
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
