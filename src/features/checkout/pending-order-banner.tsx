import { Link } from '@tanstack/react-router'
import { usePathname } from '@/components/layout/route-flags'
import { usePendingOrder } from './use-pending-order'

/**
 * Faixa global "Você tem um pedido em processamento — Acompanhar".
 * Só para o usuário autenticado dono do ponteiro; some quando o pedido chega a estado
 * terminal ou quando o usuário já está na página do próprio pedido.
 */
export function PendingOrderBanner() {
  const pathname = usePathname()
  const { orderId, isPending } = usePendingOrder()
  if (!orderId || !isPending) return null
  if (pathname === `/pedido/${orderId}`) return null

  return (
    <div className="border-b border-primary/40 bg-surface-dark" data-testid="pending-order-banner">
      <div
        role="status"
        className="mx-auto flex w-full max-w-[calc(var(--container)+3rem)] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-6 py-2.5 text-body"
      >
        <p className="flex items-center gap-2">
          <span aria-hidden className="size-2 shrink-0 animate-pulse rounded-full bg-amber motion-reduce:animate-none" />
          Você tem um pedido em processamento
        </p>
        <Link
          to="/pedido/$orderId"
          params={{ orderId }}
          className="font-bold text-text-accent underline-offset-4 hover:underline"
        >
          Acompanhar<span className="sr-only"> o pedido em processamento</span>
        </Link>
      </div>
    </div>
  )
}
