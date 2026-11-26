import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { api } from '@/api/endpoints'
import type { CreateOrderRequest, Order, Quote, QuoteStaleDetails } from '@/api/contracts'
import { qk } from '@/api/query-keys'
import { ApiError } from '@/api/errors'
import { sessionStore } from '@/app/session-store'
import { useScope } from '@/features/auth/use-scope'
import { clearIdempotencyKey, getOrCreateIdempotencyKey, setPendingOrder } from '@/features/checkout/idempotency'

const TERMINAL: Order['status'][] = ['confirmed', 'declined']
export const isTerminal = (o: Pick<Order, 'status'> | undefined) => !!o && TERMINAL.includes(o.status)

export function useOrder(orderId: string) {
  const { scope, isAuthenticated } = useScope()
  return useQuery({
    queryKey: qk.order(scope, orderId),
    queryFn: ({ signal }) => api.orders.get(orderId, { signal }),
    enabled: isAuthenticated,
    staleTime: (q) => (isTerminal(q.state.data) ? Infinity : 0),
    // Fallback se o socket estiver indisponível: polling leve enquanto pendente.
    refetchInterval: (q) => (q.state.data && !isTerminal(q.state.data) ? 5_000 : false),
  })
}

/** Efeitos quando um pedido chega a estado terminal (via REST ou Socket.IO). */
export function useOrderTerminalEffects(order: Order | undefined) {
  const queryClient = useQueryClient()
  const { scope, userId } = useScope()
  const handled = useRef<string | null>(null)
  useEffect(() => {
    if (!order || !isTerminal(order) || !userId) return
    const marker = `${order.id}:${order.status}`
    if (handled.current === marker) return
    handled.current = marker
    setPendingOrder(userId, null)
    // Servidor removeu do carrinho só o que foi comprado (confirmado) ou liberou a reserva (recusado).
    void queryClient.invalidateQueries({ queryKey: qk.cart(scope) })
    void queryClient.invalidateQueries({ queryKey: qk.quotes(scope) })
    void queryClient.invalidateQueries({ queryKey: qk.orders(scope) })
    void queryClient.invalidateQueries({ queryKey: qk.nfts.all })
  }, [order, userId, scope, queryClient])
}

export class QuoteChangedError extends Error {
  constructor(
    readonly quote: Quote,
    readonly reason: ApiError,
  ) {
    super(reason.message)
  }
}

const TRANSIENT = new Set(['TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE', 'INTERNAL_ERROR'])

/**
 * Cria o pedido com idempotência:
 * - mesma tentativa → mesma Idempotency-Key (sobrevive a refresh via sessionStorage);
 * - timeout/erro de rede → reenvia AUTOMATICAMENTE com a mesma chave (até 2x), recuperando o mesmo pedido;
 * - cotação desatualizada/estoque → QuoteChangedError com a nova cotação para o usuário reconfirmar.
 * Cliques repetidos são bloqueados por `isPending` + guarda síncrona.
 */
export function useCreateOrder() {
  const queryClient = useQueryClient()
  const { scope } = useScope()
  const inFlight = useRef(false)

  const mutation = useMutation({
    mutationKey: ['create-order'],
    mutationFn: async (body: CreateOrderRequest): Promise<Order> => {
      const userId = sessionStore.get().user?.id
      if (!userId) throw new ApiError({ code: 'UNAUTHENTICATED', message: 'Faça login para continuar.', status: 401 })
      const key = getOrCreateIdempotencyKey(userId, body)
      let lastError: unknown
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const order = await api.orders.create(body, key)
          setPendingOrder(userId, order.id)
          return order
        } catch (error) {
          lastError = error
          if (error instanceof ApiError) {
            if ((error.code === 'QUOTE_STALE' || error.code === 'AVAILABILITY_CONFLICT') && error.details) {
              clearIdempotencyKey(userId, body)
              throw new QuoteChangedError((error.details as QuoteStaleDetails).quote, error)
            }
            if (!TRANSIENT.has(error.code)) throw error
          }
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
        }
      }
      throw lastError
    },
    onSuccess: (order) => {
      queryClient.setQueryData(qk.order(scope, order.id), order)
    },
    onError: (error) => {
      if (error instanceof QuoteChangedError) {
        void queryClient.invalidateQueries({ queryKey: qk.cart(scope) })
      }
    },
  })

  const submit = async (body: CreateOrderRequest) => {
    if (inFlight.current || mutation.isPending) return undefined
    inFlight.current = true
    try {
      return await mutation.mutateAsync(body)
    } finally {
      inFlight.current = false
    }
  }

  return { ...mutation, submit }
}
