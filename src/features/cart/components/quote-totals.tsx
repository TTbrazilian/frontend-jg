import type { Quote } from '@/api/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { compareEth, formatEth, formatEthFull } from '@/lib/money'
import { cn } from '@/lib/utils'

/** Valor em ETH com o valor completo (sem arredondamento) em `title` e para leitores de tela. */
export function EthValue({ value, className, prefix, testId }: { value: string; className?: string; prefix?: string; testId?: string }) {
  const short = formatEth(value)
  const full = formatEthFull(value)
  return (
    <span className={className} title={full} data-testid={testId}>
      {prefix ? <span aria-hidden>{prefix} </span> : null}
      {short}
      {full !== short ? <span className="sr-only"> (valor exato: {full})</span> : null}
    </span>
  )
}

interface QuoteTotalsProps {
  quote: Quote
  /** Recalculando (cotação anterior exibida como placeholder). */
  recalculating?: boolean
  /** `cart`: valores 18px como no resumo do carrinho; `compact`: mobile. */
  variant?: 'cart' | 'checkout'
  /** Linha de total centralizada (lateral do Pagamento no Figma). */
  className?: string
  showTotal?: boolean
}

/**
 * Subtotal / Desconto do lançamento / Taxa de rede / Total — SEMPRE da cotação do servidor.
 * Nunca soma valores no cliente.
 */
export function QuoteTotals({ quote, recalculating = false, variant = 'cart', className, showTotal = true }: QuoteTotalsProps) {
  const hasDiscount = compareEth(quote.discountEth, '0') > 0
  return (
    <dl
      className={cn('flex flex-col gap-3 transition-opacity', recalculating && 'opacity-60', className)}
      aria-busy={recalculating || undefined}
    >
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-body-md">Subtotal</dt>
        <dd>
          <EthValue value={quote.subtotalEth} className="text-body-lg md:text-title-sm" testId="summary-subtotal" />
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-body-md">
          Desconto do lançamento
          {quote.coupon ? <span className="block text-caption text-text-secondary">Cupom {quote.coupon.code}</span> : null}
        </dt>
        <dd className={cn('text-body-md', hasDiscount && 'text-success')}>
          <EthValue value={quote.discountEth} prefix="(-)" testId="summary-discount" />
          <span className="sr-only"> de desconto</span>
        </dd>
      </div>
      <div className="flex items-start justify-between gap-4">
        <dt className="text-body-md">Taxa de rede</dt>
        <dd className="flex flex-col items-end gap-1 md:gap-3">
          <EthValue value={quote.networkFeeEth} className="text-body-lg md:text-title-sm" testId="summary-network-fee" />
          <span className="text-caption text-text-accent">Taxa estimada</span>
        </dd>
      </div>
      {showTotal ? (
        <div className={cn('flex items-baseline justify-between gap-4', variant === 'cart' ? 'mt-3' : 'border-t border-primary/40 pt-3')}>
          <dt className="text-body-lg font-bold">Total</dt>
          <dd>
            <EthValue value={quote.totalEth} className="text-title-sm font-bold text-text-accent" testId="summary-total" />
          </dd>
        </div>
      ) : null}
    </dl>
  )
}

/** Skeleton com as mesmas dimensões das linhas de valores. */
export function QuoteTotalsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)} data-testid="summary-skeleton" role="status" aria-label="Calculando valores">
      {['Subtotal', 'Desconto do lançamento', 'Taxa de rede'].map((label) => (
        <div key={label} className="flex h-5 items-center justify-between gap-4">
          <span className="text-body-md text-text-secondary">{label}</span>
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
      <div className="flex justify-end">
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="mt-3 flex h-5 items-center justify-between gap-4">
        <span className="text-body-lg font-bold">Total</span>
        <Skeleton className="h-5 w-28" />
      </div>
    </div>
  )
}
