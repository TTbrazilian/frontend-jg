import type { CartItem } from '@/api/contracts'
import { WarningIcon } from '@/components/icons'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

/** Texto da mudança de um item (ícone + texto; nunca só cor). */
export function itemIssueText(item: Pick<CartItem, 'status' | 'acknowledgedPriceEth' | 'unitPriceEth' | 'available'>): string | null {
  switch (item.status) {
    case 'ok':
      return null
    case 'price_changed':
      return `Preço alterado: de ${formatEth(item.acknowledgedPriceEth)} para ${formatEth(item.unitPriceEth)}`
    case 'insufficient':
      return `Estoque insuficiente: ${item.available === 1 ? 'resta 1 unidade' : `restam ${item.available} unidades`}`
    case 'sold_out':
      return 'Esgotado: esta edição não está mais disponível'
    case 'unavailable':
      return 'Indisponível: este NFT saiu de venda'
  }
}

export function ItemIssue({ item, className, id }: { item: CartItem; className?: string; id?: string }) {
  const text = itemIssueText(item)
  if (!text) return null
  const blocking = item.status !== 'price_changed'
  return (
    <p
      id={id}
      className={cn('flex items-start gap-1.5 text-caption font-medium', blocking ? 'text-destructive' : 'text-amber', className)}
      data-testid="cart-item-issue"
      data-status={item.status}
    >
      <WarningIcon width={14} height={14} className="mt-px shrink-0" />
      <span>{text}</span>
    </p>
  )
}
