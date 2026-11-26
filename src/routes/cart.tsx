import { useRef } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { toApiError } from '@/api/errors'
import { useSession } from '@/app/session-store'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Container } from '@/components/layout/container'
import { RelatedNfts } from '@/components/nft/related-nfts'
import { CartIcon } from '@/components/icons'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCart, useQuote } from '@/features/cart/hooks'
import { CartIssuesBanner } from '@/features/cart/components/cart-issues-banner'
import { CartItemRow } from '@/features/cart/components/cart-item-row'
import { CartSummary } from '@/features/cart/components/cart-summary'
import { MobileScreenHeader } from '@/features/cart/components/mobile-screen-header'
import { cn } from '@/lib/utils'

const COLS = ['NFTs', 'Preço', 'Edições', 'Total'] as const

export function CartPage() {
  const navigate = useNavigate()
  const session = useSession()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const cart = useCart()
  const quote = useQuote('ethereum')

  const items = cart.data?.items ?? []
  const hasItemIssues = items.some((i) => i.status !== 'ok')
  const quoteData = quote.data
  // A cotação placeholder (versão anterior do carrinho) não decide se a compra está liberada.
  const currentQuote = quoteData && !quote.isPlaceholderData ? quoteData : undefined

  let blockedReason: string | null = null
  if (hasItemIssues || currentQuote?.purchasable === false) {
    blockedReason = 'Revise e aceite as alterações dos itens para continuar.'
  } else if (!quoteData && quote.isError) {
    blockedReason = 'Não foi possível calcular os valores. Tente novamente.'
  }

  // O pagamento sempre gera e revalida uma cotação nova antes de confirmar.
  const onCheckout = () => {
    if (blockedReason || items.length === 0) return
    if (session.status === 'anonymous' || !session.user) {
      void navigate({ to: '/login', search: { redirect: '/pagamento' } })
      return
    }
    void navigate({ to: '/pagamento' })
  }

  const focusHeading = () => window.requestAnimationFrame(() => headingRef.current?.focus())

  return (
    <Container className="flex flex-col gap-24 pb-16 pt-6 md:pt-8" data-testid="cart-page">
      <div className="flex flex-col gap-3">
        <div className="max-md:hidden">
          <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/mercado' }, { label: 'Carrinho' }]} />
        </div>
        <MobileScreenHeader title="Carrinho de NFTs" backTo="/" backLabel="Voltar ao catálogo" headingRef={headingRef} />

        {cart.isPending ? (
          <CartSkeleton />
        ) : cart.isError && !cart.data ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-6">
            <p className="text-body-md font-bold">Não foi possível carregar seu carrinho.</p>
            <p className="text-body text-text-secondary">{toApiError(cart.error).message}</p>
            <Button type="button" variant="outline" onClick={() => void cart.refetch()} loading={cart.isFetching}>
              Tentar novamente
            </Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyCart />
        ) : (
          <div className="flex flex-col gap-6">
            <CartIssuesBanner items={items} />
            <div className="grid grid-cols-1 gap-x-[86px] gap-y-8 lg:grid-cols-[minmax(0,1fr)_332px]">
              <table role="table" aria-label="Itens do carrinho" className="block w-full md:-mt-3 md:table md:table-fixed md:border-separate md:border-spacing-x-0 md:border-spacing-y-3">
                <colgroup>
                  <col className="md:w-[40%]" />
                  <col className="md:w-[17.5%]" />
                  <col className="md:w-[17.5%]" />
                  <col className="md:w-[19%]" />
                  <col className="md:w-[6%]" />
                </colgroup>
                <thead role="rowgroup" className="max-md:sr-only">
                  <tr role="row">
                    {COLS.map((c, i) => (
                      <th
                        key={c}
                        role="columnheader"
                        scope="col"
                        className={cn('border-b border-primary/40 pb-3 text-left text-body-lg leading-4', i % 2 === 0 ? 'font-bold' : 'font-medium')}
                      >
                        {c}
                      </th>
                    ))}
                    <th role="columnheader" scope="col" className="border-b border-primary/40 pb-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody role="rowgroup" className="flex flex-col gap-5 md:table-row-group">
                  {items.map((item) => (
                    <CartItemRow
                      key={item.id}
                      item={item}
                      quoteLine={currentQuote?.lines.find((l) => l.itemId === item.id)}
                      onRemoved={focusHeading}
                    />
                  ))}
                </tbody>
              </table>

              <CartSummary
                cart={cart.data!}
                quote={quoteData}
                quoteLoading={quote.isPending}
                quoteRecalculating={quote.isFetching}
                quoteError={quote.isError}
                onRetryQuote={() => void quote.refetch()}
                onCheckout={onCheckout}
                blockedReason={blockedReason}
                className="md:max-lg:ml-auto md:max-lg:w-full md:max-lg:max-w-[420px]"
              />
            </div>
          </div>
        )}
      </div>

      <RelatedNfts nftId={items[0]?.nftId} title="Colecionadores também viram" />
    </Container>
  )
}

function EmptyCart() {
  return (
    <section className="flex flex-col items-center gap-4 rounded-lg bg-card px-6 py-16 text-center" data-testid="cart-empty" aria-labelledby="cart-empty-title">
      <span className="grid size-16 place-items-center rounded-full bg-surface-raised text-text-accent">
        <CartIcon width={28} height={28} />
      </span>
      <h2 id="cart-empty-title" className="text-title-sm font-bold">
        Seu carrinho está vazio
      </h2>
      <p className="max-w-md text-body text-text-secondary">Explore o catálogo e adicione NFTs para vê-los aqui.</p>
      <Link to="/" className={cn(buttonVariants({ size: 'lg' }), 'rounded-xs')}>
        Explorar o catálogo
      </Link>
    </section>
  )
}

function CartSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-x-[86px] gap-y-8 lg:grid-cols-[minmax(0,1fr)_332px]" role="status" aria-label="Carregando carrinho">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-full max-md:hidden" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex h-[100px] items-center gap-4 rounded-[14px] bg-card md:h-[70px] md:rounded-none">
            <Skeleton className="size-[100px] rounded-[14px] md:size-[70px] md:rounded-md" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-4 max-md:hidden">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}
