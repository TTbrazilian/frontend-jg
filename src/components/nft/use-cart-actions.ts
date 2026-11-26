import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '@/api/endpoints'
import { qk } from '@/api/query-keys'
import { errorMessage } from '@/api/errors'
import type { Nft, NftEdition } from '@/api/contracts'
import { useAddToCart } from '@/features/cart/hooks'
import { announce } from '@/components/layout/live-region'
import { compareEth } from '@/lib/money'
import { isEditionPurchasable } from './edition-chips'

/** Edição mais barata disponível para compra (usada pelo "adicionar" rápido dos cards). */
export function cheapestAvailableEdition(editions: NftEdition[]): NftEdition | null {
  return editions.filter(isEditionPurchasable).reduce<NftEdition | null>((best, e) => (!best || compareEth(e.priceEth, best.priceEth) < 0 ? e : best), null)
}

function notifyAdded(title: string, editionLabel: string, quantity: number, onView: () => void) {
  const msg = `${quantity > 1 ? `${quantity}× ` : ''}${title} (edição ${editionLabel}) adicionado ao carrinho.`
  toast.success(msg, { action: { label: 'Ver carrinho', onClick: onView } })
  announce(msg)
}

function notifyError(error: unknown, title: string) {
  const msg = `Não foi possível adicionar "${title}" ao carrinho. ${errorMessage(error)}`
  toast.error(msg)
  announce(msg, 'assertive')
}

/** Ações de carrinho compartilhadas por card, detalhe e barra mobile. */
export function useCartActions() {
  const add = useAddToCart()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const goToCart = () => void navigate({ to: '/carrinho' })

  /** Adiciona a edição escolhida. `then: 'cart'` leva ao carrinho (COMPRAR). */
  const addEdition = async (nft: Pick<Nft, 'id' | 'title'>, edition: NftEdition, quantity: number, then: 'stay' | 'cart' = 'stay') => {
    try {
      await add.mutateAsync({ nftId: nft.id, editionId: edition.id, quantity })
      if (then === 'cart') {
        announce(`${nft.title} adicionado ao carrinho.`)
        goToCart()
      } else notifyAdded(nft.title, edition.label, quantity, goToCart)
      return true
    } catch (error) {
      notifyError(error, nft.title)
      return false
    }
  }

  /** "Adicionar" rápido do card: busca o detalhe (cache) e escolhe a edição mais barata disponível. */
  const quickAdd = async (nftId: string, title: string) => {
    try {
      const nft = await queryClient.fetchQuery({
        queryKey: qk.nfts.detail(nftId),
        queryFn: ({ signal }) => api.nfts.detail(nftId, { signal }),
        staleTime: 15_000,
      })
      const edition = cheapestAvailableEdition(nft.editions)
      if (!edition) {
        const msg = `${title} está esgotado.`
        toast.error(msg)
        announce(msg, 'assertive')
        return false
      }
      return addEdition(nft, edition, 1)
    } catch (error) {
      notifyError(error, title)
      return false
    }
  }

  return { addEdition, quickAdd, isPending: add.isPending }
}
