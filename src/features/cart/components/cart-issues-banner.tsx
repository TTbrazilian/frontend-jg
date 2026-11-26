import { toast } from 'sonner'
import type { CartItem } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { WarningIcon } from '@/components/icons'
import { announce } from '@/components/layout/live-region'
import { Button } from '@/components/ui/button'
import { useAcknowledgeCart } from '@/features/cart/hooks'
import { cn } from '@/lib/utils'
import { itemIssueText } from './item-issue'

/**
 * Aviso no topo quando itens mudaram (preço/estoque) desde que foram adicionados.
 * "Revisar e aceitar alterações" confirma no servidor (preço atual, quantidades ajustadas,
 * itens esgotados removidos).
 */
export function CartIssuesBanner({ items, className }: { items: CartItem[]; className?: string }) {
  const acknowledge = useAcknowledgeCart()
  const changed = items.filter((i) => i.status !== 'ok')
  if (changed.length === 0) return null

  const onAccept = () => {
    acknowledge.mutate(undefined, {
      onSuccess: () => {
        const msg = 'Alterações aceitas. O carrinho foi atualizado com os valores atuais.'
        toast.success(msg)
        announce(msg)
      },
      onError: (err) => toast.error(toApiError(err).message),
    })
  }

  return (
    <section
      aria-labelledby="cart-issues-title"
      className={cn('flex flex-col gap-3 rounded-lg border border-amber/50 bg-amber/10 p-4 md:flex-row md:items-center md:justify-between', className)}
      data-testid="cart-issues-banner"
    >
      <div className="flex gap-3">
        <WarningIcon width={20} height={20} className="mt-0.5 shrink-0 text-amber" />
        <div className="flex flex-col gap-1">
          <h2 id="cart-issues-title" className="text-body-md font-bold text-foreground">
            Alguns itens mudaram desde que você os adicionou
          </h2>
          <ul className="flex flex-col gap-0.5 text-caption text-text-secondary">
            {changed.map((i) => (
              <li key={i.id}>
                <span className="font-bold text-foreground">{i.title}</span> — {itemIssueText(i)}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Button type="button" variant="outline" onClick={onAccept} loading={acknowledge.isPending} className="shrink-0 whitespace-normal" data-testid="cart-acknowledge">
        Revisar e aceitar alterações
      </Button>
    </section>
  )
}
