import type { QueryClient } from '@tanstack/react-query'
import { safeStorage } from '@/lib/utils'

/** Prefixos de chaves de armazenamento do cliente que contêm dados privados por usuário. */
export const PRIVATE_STORAGE_PREFIXES = ['nft.checkout.', 'nft.pendingOrder.', 'nft.idem.']

/**
 * Limpa dados privados do cliente de um usuário (cache do Query + rascunhos/pedidos pendentes
 * em storage). Chamado no logout e na troca de usuário.
 */
export function clearPrivateClientState(queryClient: QueryClient, userId: string) {
  queryClient.removeQueries({ queryKey: ['private', `user:${userId}`] })
  for (const kind of ['local', 'session'] as const) {
    const s = safeStorage(kind)
    if (!s) continue
    const keys: string[] = []
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i)
      if (k && PRIVATE_STORAGE_PREFIXES.some((p) => k.startsWith(p)) && k.includes(userId)) keys.push(k)
    }
    keys.forEach((k) => s.removeItem(k))
  }
}
