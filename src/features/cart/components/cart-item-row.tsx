import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CartItem, QuoteLine } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { qk } from '@/api/query-keys'
import { TrashIcon } from '@/components/icons'
import { announce } from '@/components/layout/live-region'
import { NftImage } from '@/components/nft/nft-image'
import { QuantityStepper } from '@/components/nft/quantity-stepper'
import { useScope } from '@/features/auth/use-scope'
import { useRemoveCartItem, useUpdateCartItem } from '@/features/cart/hooks'
import { formatEth, mulEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { EthValue } from './quote-totals'
import { ItemIssue } from './item-issue'

interface CartItemRowProps {
  item: CartItem
  /** Linha correspondente da cotação do servidor (quando atual). */
  quoteLine?: QuoteLine
  /** Chamado após a remoção (para devolver o foco a um ponto estável da página). */
  onRemoved?: () => void
}

/**
 * Linha do carrinho. Uma única marcação para todos os tamanhos:
 * tabela no desktop (≥768px) e card no mobile (como `mobile-carrinho-de-nfts`).
 * Os papéis ARIA explícitos mantêm a semântica de tabela mesmo com `display` alterado.
 */
export function CartItemRow({ item, quoteLine, onRemoved }: CartItemRowProps) {
  const queryClient = useQueryClient()
  const { scope } = useScope()
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()

  const pending = update.isPending || remove.isPending
  const quantity = update.isPending && update.variables ? update.variables.quantity : item.quantity
  const max = Math.min(item.available, item.maxPerOrder)
  const blocked = item.status === 'sold_out' || item.status === 'unavailable'
  // Total da linha: da cotação do servidor quando ela corresponde ao estado atual; senão unitário × quantidade (Big.js).
  const lineTotal =
    quoteLine && quoteLine.quantity === quantity && quoteLine.unitPriceEth === item.unitPriceEth
      ? quoteLine.lineTotalEth
      : mulEth(item.unitPriceEth, quantity)
  const issueId = `cart-issue-${item.id}`
  const hasIssue = item.status !== 'ok'

  const onQuantity = (next: number) => {
    if (next === item.quantity || pending) return
    update.mutate(
      { itemId: item.id, quantity: next },
      {
        onSuccess: () => announce(`Quantidade de ${item.title} atualizada para ${next}.`),
        onError: (err) => {
          const e = toApiError(err)
          toast.error(e.message, { id: `cart-qty-${item.id}` })
          announce(`${e.message} A quantidade voltou para ${item.quantity}.`, 'assertive')
          // Volta ao valor do servidor (o servidor pode ter mudado estoque/preço).
          void queryClient.invalidateQueries({ queryKey: qk.cart(scope) })
        },
      },
    )
  }

  const onRemove = () => {
    if (pending) return
    // mutateAsync: a linha some na hora (remoção otimista) e desmonta; callbacks de `mutate`
    // não rodariam após o unmount, a promessa sim — o toast/anúncio sempre acontece.
    remove.mutateAsync(item.id).then(
      () => {
        const msg = `${item.title} removido do carrinho.`
        toast.success(msg, { id: `cart-remove-${item.id}` })
        announce(msg)
      },
      (err: unknown) => {
        const e = toApiError(err)
        toast.error(`Não foi possível remover ${item.title}: ${e.message}`)
        announce(`Não foi possível remover ${item.title}.`, 'assertive')
      },
    )
    onRemoved?.()
  }

  return (
    <tr
      role="row"
      data-testid="cart-item"
      data-item-id={item.id}
      data-status={item.status}
      aria-busy={pending || undefined}
      className={cn(
        'relative flex min-h-[100px] items-stretch rounded-[14px] bg-card shadow-overlay',
        'md:table-row md:min-h-0 md:rounded-none md:shadow-none',
        hasIssue && 'max-md:ring-1 max-md:ring-amber/60',
        blocked && 'max-md:ring-destructive/60',
      )}
    >
      {/* NFT: miniatura + título + ID do token + edição (+ total no mobile) */}
      <td
        role="cell"
        className={cn(
          'flex min-w-0 flex-1 md:table-cell md:align-middle',
          hasIssue && 'md:shadow-[inset_3px_0_0_var(--color-amber)]',
          blocked && 'md:shadow-[inset_3px_0_0_var(--color-destructive)]',
        )}
      >
        <div className="flex w-full items-stretch gap-[9px] md:items-center md:gap-4">
          <NftImage
            image={item.image}
            sizes="100px"
            decorative
            className={cn(
              'size-[100px] shrink-0 self-start rounded-[14px] md:size-[70px] md:self-center md:rounded-md',
              blocked && 'opacity-50 grayscale',
            )}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-3 pr-1 md:py-3 md:pr-2">
            <p className="text-body-md font-bold leading-4 break-words md:text-body-lg">{item.title}</p>
            <p className="text-body leading-4 text-text-secondary md:hidden">Edição: {item.editionLabel}</p>
            <p className="text-body leading-4 text-sand max-md:sr-only">ID do token: #{item.tokenId}</p>
            <p className="text-caption leading-4 text-text-secondary max-md:hidden">Edição {item.editionLabel}</p>
            <p className="mt-auto pt-2 text-title-sm font-bold leading-4 text-text-accent md:hidden" aria-hidden>
              {formatEth(lineTotal)}
            </p>
            <ItemIssue item={item} id={issueId} />
          </div>
        </div>
      </td>
      <td role="cell" className="max-md:sr-only md:table-cell md:align-middle">
        <span className="sr-only">Preço unitário: </span>
        <EthValue value={item.unitPriceEth} className={cn('text-body-lg font-bold text-text-secondary', item.status === 'price_changed' && 'text-amber')} />
      </td>
      <td role="cell" className="flex items-end pb-4 pr-4 md:table-cell md:p-0 md:align-middle">
        <QuantityStepper
          size="sm"
          value={quantity}
          min={1}
          max={max}
          onChange={onQuantity}
          disabled={pending || blocked}
          label={`Quantidade de ${item.title}`}
        />
      </td>
      <td role="cell" className="max-md:sr-only md:table-cell md:align-middle">
        <span className="sr-only">Total da linha: </span>
        <EthValue value={lineTotal} className="text-body-lg font-bold text-text-accent" />
      </td>
      <td role="cell" className="absolute right-1 top-1 md:static md:table-cell md:pr-6 md:align-middle">
        <button
          type="button"
          onClick={onRemove}
          disabled={pending}
          aria-label={`Remover ${item.title}`}
          className="grid size-10 place-items-center rounded-md text-primary transition-colors hover:text-text-accent disabled:opacity-40 md:ml-auto md:text-sand"
          data-testid="cart-item-remove"
        >
          <TrashIcon width={24} height={24} />
        </button>
      </td>
    </tr>
  )
}
