import { useState } from 'react'
import type { Cart, Quote } from '@/api/contracts'
import { NftImage } from '@/components/nft/nft-image'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CouponForm } from '@/features/cart/components/coupon-form'
import { EthValue, QuoteTotals, QuoteTotalsSkeleton } from '@/features/cart/components/quote-totals'
import { cn } from '@/lib/utils'

interface CheckoutSummaryProps {
  cart: Cart | undefined
  quote: Quote | undefined
  loading: boolean
  recalculating: boolean
  error: boolean
  onRetry: () => void
  className?: string
}

/**
 * Lateral "Seus NFTs" do Figma: linhas (miniatura, título, ID do token, quantidade, subtotal),
 * cupom ("Tem um código promocional? Aplique aqui") e totais — tudo da cotação da rede selecionada.
 */
export function CheckoutSummary({ cart, quote, loading, recalculating, error, onRetry, className }: CheckoutSummaryProps) {
  const [couponOpen, setCouponOpen] = useState(false)
  const coupon = cart?.coupon ?? null

  return (
    <div className={cn('flex flex-col gap-3', className)} aria-busy={loading || recalculating || undefined}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-body-lg leading-4">
          <span className="font-bold">NFTs</span>
          <span className="font-medium">Subtotal</span>
        </div>
        <div aria-hidden className="h-px bg-primary/40" />
      </div>

      {quote && !loading ? (
        <ul className={cn('flex flex-col gap-3 transition-opacity', recalculating && 'opacity-60')} aria-label="NFTs do pedido">
          {quote.lines.map((line) => (
            <li key={line.itemId} className="flex min-h-[70px] items-center gap-2 bg-card pl-1 pr-4" data-testid="checkout-line">
              <NftImage image={line.image} sizes="70px" decorative className="size-[70px] shrink-0 rounded-lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-2">
                <p className="truncate text-body-lg font-bold leading-4" title={line.title}>
                  {line.title}
                </p>
                <p className="truncate text-body leading-4 text-sand">ID do token: #{line.tokenId}</p>
                <p className="sr-only">Edição {line.editionLabel}</p>
              </div>
              <span className="flex shrink-0 flex-col items-end gap-1.5">
                <EthValue value={line.lineTotalEth} className="text-title-sm font-bold leading-4 text-text-accent" />
                <span className="text-body leading-4 text-text-secondary">
                  <span aria-hidden>(x {line.quantity})</span>
                  <span className="sr-only">{line.quantity} {line.quantity === 1 ? 'unidade' : 'unidades'}</span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : error && !quote ? null : (
        <ul className="flex flex-col gap-3" aria-hidden>
          {[0, 1].map((i) => (
            <li key={i} className="flex h-[70px] items-center gap-2 bg-card pl-1 pr-4">
              <Skeleton className="size-[62px] rounded-lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-16" />
            </li>
          ))}
        </ul>
      )}

      <div className="py-1 text-center">
        {coupon || couponOpen ? (
          <CouponForm coupon={coupon} autoFocus={!coupon} className="text-left" />
        ) : (
          <p className="text-body leading-4">
            Tem um código promocional?{' '}
            <button
              type="button"
              onClick={() => setCouponOpen(true)}
              className="font-bold text-text-accent underline-offset-4 hover:underline"
              aria-expanded={false}
            >
              Aplique aqui
            </button>
          </p>
        )}
      </div>

      {error && !quote ? (
        <div role="alert" className="flex flex-col items-start gap-2 text-body text-destructive">
          Não foi possível calcular os valores.
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      ) : quote && !loading ? (
        <QuoteTotals quote={quote} recalculating={recalculating} variant="checkout" />
      ) : (
        <QuoteTotalsSkeleton />
      )}
    </div>
  )
}
