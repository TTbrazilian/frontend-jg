import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Cart, FeaturedResponse, Nft, NftListResponse, NftSummary, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/api/contracts'
import { qk } from '@/api/query-keys'
import { getGuestCartId, sessionScope, sessionStore, useSession } from '@/app/session-store'
import { announce } from '@/components/layout/live-region'
import { formatEth } from '@/lib/money'
import { createSocket, type AppSocket } from './socket'
import { EventLedger } from './event-ledger'

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

interface RealtimeContextValue {
  status: RealtimeStatus
  socket: AppSocket | null
}

const RealtimeContext = createContext<RealtimeContextValue>({ status: 'disconnected', socket: null })

export const useRealtime = () => useContext(RealtimeContext)

/**
 * Aplica `nft.updated` em todos os caches que exibem preço/disponibilidade:
 * detalhe, listas, destaques e relacionados. Só aplica se a versão do evento for
 * maior que a versão em cache (nunca regride um estado mais novo).
 */
function applyNftUpdate(queryClient: QueryClient, event: NftUpdatedEvent) {
  const { data, version } = event
  const patchSummary = (s: NftSummary): NftSummary =>
    s.id === data.nftId && version > s.version
      ? { ...s, minPriceEth: data.minPriceEth, available: data.available, soldOut: data.soldOut, version }
      : s

  queryClient.setQueryData<Nft>(qk.nfts.detail(data.nftId), (old) => {
    if (!old || version <= old.version) return old
    const editions = old.editions.map((e) => {
      const upd = data.editions.find((x) => x.id === e.id)
      return upd ? { ...e, priceEth: upd.priceEth, available: upd.available, status: upd.status } : e
    })
    return { ...old, editions, minPriceEth: data.minPriceEth, available: data.available, soldOut: data.soldOut, version }
  })
  queryClient.setQueriesData<NftListResponse>({ queryKey: qk.nfts.lists() }, (old) =>
    old ? { ...old, items: old.items.map(patchSummary) } : old,
  )
  queryClient.setQueriesData<FeaturedResponse>({ queryKey: qk.nfts.featured() }, (old) =>
    old ? { ...old, items: old.items.map(patchSummary) } : old,
  )
  queryClient.setQueriesData<{ items: NftSummary[] }>({ queryKey: ['nfts', 'related'] }, (old) =>
    old ? { ...old, items: old.items.map(patchSummary) } : old,
  )
}

/** Maior versão conhecida de um NFT em qualquer cache (REST ou eventos já aplicados). */
function knownNftVersion(queryClient: QueryClient, nftId: string): number {
  let v = queryClient.getQueryData<Nft>(qk.nfts.detail(nftId))?.version ?? 0
  for (const [, data] of queryClient.getQueriesData<NftListResponse | FeaturedResponse | { items: NftSummary[] }>({ queryKey: qk.nfts.all })) {
    const hit = data && 'items' in data ? data.items.find((i) => i.id === nftId) : undefined
    if (hit && hit.version > v) v = hit.version
  }
  return v
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const session = useSession()
  const [status, setStatus] = useState<RealtimeStatus>('disconnected')
  const [socket, setSocket] = useState<AppSocket | null>(null)
  const ledgerRef = useRef(new EventLedger())

  // Um socket por identidade (epoch muda em login/logout/troca de usuário).
  const identity = session.status === 'authenticated' ? `${session.user?.id}:${session.epoch}` : `guest:${session.epoch}`
  const token = session.status === 'authenticated' ? session.token : null

  useEffect(() => {
    const ledger = new EventLedger()
    ledgerRef.current = ledger
    const owner = sessionStore.get().user?.id ?? null
    const s = createSocket({ token, guestCartId: getGuestCartId() })
    let everConnected = false
    setSocket(s)
    setStatus('connecting')

    const onConnect = () => {
      setStatus('connected')
      if (everConnected) {
        // Reconexão: reconcilia recursos ativos com a API REST (eventos perdidos durante a queda).
        void queryClient.invalidateQueries({ queryKey: qk.nfts.all, refetchType: 'active' })
        void queryClient.invalidateQueries({ queryKey: ['private'], refetchType: 'active' })
        announce('Conexão em tempo real restabelecida. Dados atualizados.')
      }
      everConnected = true
    }
    const onDisconnect = () => setStatus(s.active ? 'reconnecting' : 'disconnected')
    const onConnectError = () => setStatus(s.active ? 'reconnecting' : 'disconnected')

    const onNftUpdated = (event: NftUpdatedEvent) => {
      if (!ledger.accept(event)) return // duplicado ou antigo: ignora sem reaplicar efeitos
      // REST pode já ter trazido esta versão: não reaplica no catálogo, mas o carrinho ainda precisa reconciliar.
      const alreadyKnown = knownNftVersion(queryClient, event.data.nftId) >= event.version
      if (!alreadyKnown) applyNftUpdate(queryClient, event)
      // Carrinho: se o NFT estiver no carrinho, revalida carrinho + cotação e informa o usuário.
      const scope = sessionScope()
      const cart = queryClient.getQueryData<Cart>(qk.cart(scope))
      const inCart = cart?.items.filter((i) => i.nftId === event.data.nftId) ?? []
      if (inCart.length) {
        void queryClient.invalidateQueries({ queryKey: qk.cart(scope) })
        void queryClient.invalidateQueries({ queryKey: qk.quotes(scope) })
        const item = inCart[0]
        const upd = event.data.editions.find((e) => e.id === item.editionId)
        const msg = upd
          ? upd.available === 0 || upd.status !== 'available'
            ? `${item.title} (${item.editionLabel}) esgotou ou ficou indisponível.`
            : upd.priceEth !== item.unitPriceEth
              ? `O preço de ${item.title} mudou para ${formatEth(upd.priceEth)}.`
              : `A disponibilidade de ${item.title} mudou.`
          : `${item.title} foi atualizado.`
        toast.warning(msg, { id: `nft-${event.data.nftId}` })
        announce(msg)
      }
    }

    const onOrderUpdated = (event: OrderUpdatedEvent) => {
      const current = sessionStore.get()
      // Isolamento: evento de outra identidade (sessão anterior) é descartado.
      if (!current.user || current.user.id !== owner || event.data.order.userId !== current.user.id) return
      if (!ledger.accept(event)) return
      const scope = sessionScope()
      const key = qk.order(scope, event.data.order.id)
      const cached = queryClient.getQueryData<Order>(key)
      // Estados terminais não regridem; versão menor é ignorada.
      if (cached && (cached.version >= event.version || cached.status !== 'pending')) return
      queryClient.setQueryData<Order>(key, event.data.order)
      void queryClient.invalidateQueries({ queryKey: qk.orders(scope), exact: true })
      const st = event.data.order.status
      if (st === 'confirmed') announce('Pagamento confirmado. Seus NFTs estão na sua carteira.')
      if (st === 'declined') announce('Pagamento recusado. Seus itens continuam no carrinho.', 'assertive')
    }

    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)
    s.on('connect_error', onConnectError)
    s.on('nft.updated', onNftUpdated)
    s.on('order.updated', onOrderUpdated)
    s.io.on('reconnect_attempt', () => setStatus('reconnecting'))
    s.connect()

    return () => {
      // Libera listeners e a conexão da identidade anterior.
      s.off('connect', onConnect)
      s.off('disconnect', onDisconnect)
      s.off('connect_error', onConnectError)
      s.off('nft.updated', onNftUpdated)
      s.off('order.updated', onOrderUpdated)
      s.io.off('reconnect_attempt')
      s.disconnect()
      setSocket(null)
    }
  }, [identity, token, queryClient])

  return <RealtimeContext.Provider value={{ status, socket }}>{children}</RealtimeContext.Provider>
}
