import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/endpoints'
import type { Order } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { qk } from '@/api/query-keys'
import { usePathname } from '@/components/layout/route-flags'
import { useScope } from '@/features/auth/use-scope'
import { isTerminal, useOrderTerminalEffects } from '@/features/orders/hooks'
import { getPendingOrder, setPendingOrder } from './idempotency'

/**
 * Ponteiro do pedido em processamento do usuário ATUAL (localStorage por userId) +
 * estado do pedido no servidor (mesma query key de `useOrder`, cache compartilhado).
 * Relido a cada navegação e quando outra aba altera o storage.
 */
export function usePendingOrder(): { orderId: string | null; order: Order | undefined; isPending: boolean; isChecking: boolean } {
  const { scope, userId, isAuthenticated } = useScope()
  const pathname = usePathname()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith('nft.pendingOrder.')) setTick((t) => t + 1)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Leitura barata do storage; `pathname`/`tick` forçam a releitura após navegar ou mudar em outra aba.
  void pathname
  void tick
  const orderId = userId ? getPendingOrder(userId) : null

  const query = useQuery({
    queryKey: qk.order(scope, orderId ?? '__none__'),
    queryFn: ({ signal }) => api.orders.get(orderId as string, { signal }),
    enabled: isAuthenticated && !!orderId,
    staleTime: (q) => (isTerminal(q.state.data) ? Infinity : 0),
    refetchInterval: (q) => (q.state.data && !isTerminal(q.state.data) ? 5_000 : false),
  })

  const order = orderId ? query.data : undefined
  useOrderTerminalEffects(order)

  // Ponteiro órfão (pedido inexistente/de outra conta): descarta.
  useEffect(() => {
    if (!userId || !orderId || !query.error) return
    const code = toApiError(query.error).code
    if (code === 'NOT_FOUND' || code === 'FORBIDDEN') {
      setPendingOrder(userId, null)
      setTick((t) => t + 1)
    }
  }, [query.error, orderId, userId])

  const isPending = !!orderId && !!order && order.status === 'pending'
  const isChecking = !!orderId && !order && query.isPending && query.fetchStatus !== 'idle'
  return { orderId, order, isPending, isChecking }
}
