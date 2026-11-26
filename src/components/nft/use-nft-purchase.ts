import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Nft, NftEdition } from '@/api/contracts'
import { qk } from '@/api/query-keys'
import { announce } from '@/components/layout/live-region'
import { compareEth, formatEth, mulEth } from '@/lib/money'
import { isEditionPurchasable } from './edition-chips'
import { cheapestAvailableEdition, useCartActions } from './use-cart-actions'

function defaultEdition(nft: Nft): NftEdition | undefined {
  return cheapestAvailableEdition(nft.editions) ?? nft.editions[0]
}

/** Texto do limite de quantidade: o que restringe mais (estoque ou limite por pedido). */
export function quantityHint(edition: NftEdition | undefined): string {
  if (!edition) return ''
  if (edition.status === 'unavailable') return 'Edição indisponível no momento'
  if (!isEditionPurchasable(edition)) return 'Edição esgotada'
  return edition.maxPerOrder <= edition.available
    ? `Máx. ${edition.maxPerOrder} por pedido`
    : `${edition.available} ${edition.available === 1 ? 'disponível' : 'disponíveis'}`
}

/**
 * Estado de compra do detalhe: edição escolhida, quantidade (limitada a min(disponível, máx. por
 * pedido)) e ações. Preço e estoque vêm SEMPRE do cache (atualizado pelos eventos em tempo real):
 * se a edição esgotar ou mudar de preço enquanto a página está aberta, a UI reage e avisa.
 */
export function useNftPurchase(nft: Nft) {
  const queryClient = useQueryClient()
  const { addEdition } = useCartActions()
  const [editionId, setEditionId] = useState<string | undefined>(() => defaultEdition(nft)?.id)
  const [quantity, setQuantity] = useState(1)
  const [pending, setPending] = useState<'buy' | 'add' | null>(null)

  const edition = nft.editions.find((e) => e.id === editionId) ?? defaultEdition(nft)
  const purchasable = !!edition && isEditionPurchasable(edition)
  const max = edition && purchasable ? Math.max(1, Math.min(edition.available, edition.maxPerOrder)) : 1

  // Estoque diminuiu ao vivo: a quantidade nunca passa do novo máximo.
  useEffect(() => {
    if (quantity > max) setQuantity(max)
  }, [quantity, max])

  // Mudanças ao vivo na edição escolhida (via Socket.IO → cache).
  const prev = useRef<{ id?: string; purchasable: boolean; price?: string }>({ id: edition?.id, purchasable, price: edition?.priceEth })
  useEffect(() => {
    const before = prev.current
    prev.current = { id: edition?.id, purchasable, price: edition?.priceEth }
    if (!edition || before.id !== edition.id) return
    if (before.purchasable && !purchasable) {
      const msg = `A edição ${edition.label} de ${nft.title} acabou de ${edition.status === 'unavailable' ? 'ficar indisponível' : 'esgotar'}.`
      toast.warning(msg, { id: `live-${nft.id}` })
      announce(msg, 'assertive')
    } else if (before.price && compareEth(before.price, edition.priceEth) !== 0) {
      const msg = `O preço da edição ${edition.label} mudou para ${formatEth(edition.priceEth)}.`
      toast.info(msg, { id: `live-price-${nft.id}` })
      announce(msg)
    }
  }, [edition, purchasable, nft.id, nft.title])

  const selectEdition = (id: string) => {
    setEditionId(id)
    setQuantity(1)
  }

  const run = async (kind: 'buy' | 'add') => {
    if (!edition || !purchasable || pending) return
    setPending(kind)
    const ok = await addEdition(nft, edition, quantity, kind === 'buy' ? 'cart' : 'stay')
    setPending(null)
    // Conflito de estoque/preço: revalida o detalhe para mostrar o estado atual.
    if (!ok) void queryClient.invalidateQueries({ queryKey: qk.nfts.detail(nft.id) })
  }

  return {
    edition,
    purchasable,
    quantity,
    setQuantity,
    max,
    hint: quantityHint(edition),
    total: edition ? mulEth(edition.priceEth, quantity) : '0',
    selectEdition,
    pending,
    buyNow: () => void run('buy'),
    addToCart: () => void run('add'),
  }
}

export type NftPurchase = ReturnType<typeof useNftPurchase>
