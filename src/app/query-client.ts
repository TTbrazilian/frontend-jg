import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/errors'

/**
 * Política de cache/retry (documentada em ARCHITECTURE.md):
 * - Catálogo: staleTime 30s, gcTime 5min, refetch ao focar.
 * - Privados: staleTime 0..15s (definido por query), isolados por escopo de usuário.
 * - Retry: só para erros marcados `retryable` (rede, timeout, 5xx/503), até 2 tentativas
 *   com backoff exponencial. 4xx de negócio nunca são repetidos.
 * - Mutations: sem retry automático (idempotência é tratada explicitamente no checkout).
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) return error.retryable && failureCount < 2
  return failureCount < 1
}

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache(),
    mutationCache: new MutationCache(),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4_000),
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  })
}

export const queryClient = createQueryClient()
