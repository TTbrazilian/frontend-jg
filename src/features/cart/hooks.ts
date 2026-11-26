import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/endpoints'
import type { AddCartItemRequest, Cart, NetworkId } from '@/api/contracts'
import { qk } from '@/api/query-keys'
import { useScope } from '@/features/auth/use-scope'
import { useSession } from '@/app/session-store'

/**
 * Carrinho vive no servidor (mock): visitante identificado por X-Guest-Cart-Id,
 * usuário pelo token. Sobrevive a refresh e é mesclado no login.
 * Toda mutation devolve o Cart completo → gravamos direto no cache (sem refetch extra)
 * e invalidamos a cotação (que depende da versão do carrinho).
 */
export function useCart() {
  const { scope } = useScope()
  const session = useSession()
  return useQuery({
    queryKey: qk.cart(scope),
    queryFn: ({ signal }) => api.cart.get({ signal }),
    // Sessão expirada: mantém o último snapshot sem chamar a API até reautenticar.
    enabled: session.status !== 'expired',
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  })
}

export function useCartCount(): number {
  const { data } = useCart()
  return data?.itemCount ?? 0
}

function useApplyCart() {
  const queryClient = useQueryClient()
  const { scope } = useScope()
  return (cart: Cart) => {
    // Respostas fora de ordem (cliques rápidos): nunca regride para uma versão mais antiga do carrinho.
    const current = queryClient.getQueryData<Cart>(qk.cart(scope))
    if (current && current.id === cart.id && current.version > cart.version) return
    queryClient.setQueryData(qk.cart(scope), cart)
    void queryClient.invalidateQueries({ queryKey: qk.quotes(scope) })
  }
}

export function useAddToCart() {
  const apply = useApplyCart()
  return useMutation({ mutationFn: (body: AddCartItemRequest) => api.cart.addItem(body), onSuccess: apply })
}

export function useUpdateCartItem() {
  const apply = useApplyCart()
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => api.cart.updateItem(itemId, { quantity }),
    onSuccess: apply,
  })
}

/** Remoção otimista com rollback. */
export function useRemoveCartItem() {
  const queryClient = useQueryClient()
  const { scope } = useScope()
  const apply = useApplyCart()
  return useMutation({
    mutationFn: (itemId: string) => api.cart.removeItem(itemId),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: qk.cart(scope) })
      const previous = queryClient.getQueryData<Cart>(qk.cart(scope))
      if (previous) {
        const items = previous.items.filter((i) => i.id !== itemId)
        queryClient.setQueryData<Cart>(qk.cart(scope), { ...previous, items, itemCount: items.reduce((a, i) => a + i.quantity, 0) })
      }
      return { previous }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(qk.cart(scope), ctx.previous)
    },
    onSuccess: apply,
  })
}

export function useApplyCoupon() {
  const apply = useApplyCart()
  return useMutation({ mutationFn: (code: string) => api.cart.applyCoupon({ code }), onSuccess: apply })
}

export function useRemoveCoupon() {
  const apply = useApplyCart()
  return useMutation({ mutationFn: () => api.cart.removeCoupon(), onSuccess: apply })
}

/** Aceita as alterações de preço/disponibilidade informadas pelo servidor. */
export function useAcknowledgeCart() {
  const apply = useApplyCart()
  return useMutation({ mutationFn: () => api.cart.acknowledge(), onSuccess: apply })
}

/**
 * Cotação do servidor = fonte da verdade para subtotal/desconto/taxa/total.
 * A key inclui a versão do carrinho: qualquer mudança gera nova cotação.
 */
export function useQuote(network: NetworkId, opts: { enabled?: boolean } = {}) {
  const { scope } = useScope()
  const session = useSession()
  const cart = useCart()
  const version = cart.data?.version
  return useQuery({
    queryKey: qk.quote(scope, version, network),
    queryFn: ({ signal }) => api.quotes.create({ network }, { signal }),
    enabled: (opts.enabled ?? true) && version !== undefined && session.status !== 'expired',
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  })
}
