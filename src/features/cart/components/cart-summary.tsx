import { Link } from '@tanstack/react-router'
import type { Cart, Quote } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CouponForm } from './coupon-form'
import { QuoteTotals, QuoteTotalsSkeleton } from './quote-totals'

interface CartSummaryProps {
  cart: Cart
  quote: Quote | undefined
  quoteLoading: boolean
  quoteRecalculating: boolean
  quoteError: boolean
  onRetryQuote: () => void
  onCheckout: () => void
  /** Motivo visível quando "Conectar e finalizar" está bloqueado. */
  blockedReason: string | null
  className?: string
}

/**
 * "Resumo da carteira" (desktop) / painel inferior fixo (mobile).
 * Valores exclusivamente da cotação do servidor.
 */
export function CartSummary({
  cart,
  quote,
  quoteLoading,
  quoteRecalculating,
  quoteError,
  onRetryQuote,
  onCheckout,
  blockedReason,
  className,
}: CartSummaryProps) {
  const reasonId = 'checkout-cta-reason'
  return (
    <aside
      aria-labelledby="cart-summary-title"
      aria-busy={quoteLoading || quoteRecalculating || undefined}
      className={cn(
        'flex flex-col gap-6',
        // mobile: painel inferior fixo (cupom + resumo + CTA), como no Figma
        'max-md:sticky max-md:bottom-[var(--tabbar-height,0px)] max-md:z-20 max-md:-mx-6 max-md:gap-3 max-md:rounded-t-[40px] max-md:bg-card max-md:px-6 max-md:pb-9 max-md:pt-6 max-md:shadow-overlay',
        className,
      )}
    >
      <div className="flex flex-col gap-3 max-md:sr-only">
        <h2 id="cart-summary-title" className="text-title-sm font-bold leading-4">
          Resumo da carteira
        </h2>
        <div aria-hidden className="h-px bg-primary/40" />
      </div>

      <CouponForm coupon={cart.coupon} className="max-md:[&_label]:sr-only" />

      {quoteError && !quote ? (
        <div role="alert" className="flex flex-col items-start gap-2 text-body text-destructive">
          Não foi possível calcular os valores.
          <Button type="button" variant="outline" size="sm" onClick={onRetryQuote}>
            Tentar novamente
          </Button>
        </div>
      ) : quote && !quoteLoading ? (
        <QuoteTotals quote={quote} recalculating={quoteRecalculating} className="md:mt-0" />
      ) : (
        <QuoteTotalsSkeleton />
      )}

      <div className="flex flex-col items-stretch gap-3 max-md:mt-5">
        <Button
          type="button"
          onClick={onCheckout}
          aria-disabled={blockedReason ? true : undefined}
          aria-describedby={blockedReason ? reasonId : undefined}
          className="h-10 rounded-xs text-body-md max-md:h-[60px] max-md:rounded-pill max-md:bg-gradient-to-r max-md:from-primary max-md:to-primary/80 max-md:text-body-lg"
          data-testid="checkout-cta"
        >
          Conectar e finalizar
        </Button>
        {blockedReason ? (
          <p id={reasonId} className="text-center text-caption text-text-secondary" data-testid="checkout-cta-reason">
            {blockedReason}
          </p>
        ) : null}
        <Link to="/" className="text-center text-body-md text-text-accent hover:underline max-md:hidden">
          Continuar explorando
        </Link>
      </div>
    </aside>
  )
}
