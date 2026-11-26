import { Link } from '@tanstack/react-router'
import type { Order } from '@/api/contracts'
import { NETWORK_LABELS } from '@/api/contracts'
import { WarningIcon } from '@/components/icons'
import { NftImage } from '@/components/nft/nft-image'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EthValue } from '@/features/cart/components/quote-totals'
import { cn } from '@/lib/utils'

/** Lista compacta das linhas do pedido (snapshot), usada em pendente/recusado. */
function OrderLines({ order }: { order: Order }) {
  return (
    <ul className="flex flex-col gap-3" aria-label="Itens do pedido">
      {order.lines.map((line) => (
        <li key={line.itemId} className="flex items-center gap-3 rounded-lg bg-card pr-4">
          <NftImage image={line.image} sizes="64px" decorative className="size-16 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="truncate text-body-md font-bold leading-4">{line.title}</p>
            <p className="text-caption text-sand">
              ID do token: #{line.tokenId} · Edição {line.editionLabel} · x{line.quantity}
            </p>
          </div>
          <EthValue value={line.lineTotalEth} className="shrink-0 text-body-lg font-bold text-text-accent" />
        </li>
      ))}
      <li className="flex items-baseline justify-between border-t border-primary/40 pt-3">
        <span className="text-body-lg font-bold">Total</span>
        <EthValue value={order.totalEth} className="text-title-sm font-bold text-text-accent" />
      </li>
    </ul>
  )
}

export function OrderPending({ order }: { order: Order }) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-labelledby="order-pending-title"
      className="flex flex-col gap-6 rounded-lg border border-border bg-card/60 p-6 md:p-8"
      data-testid="order-pending"
    >
      <div className="flex items-start gap-4">
        <span aria-hidden className="mt-1 size-6 shrink-0 animate-spin rounded-full border-[3px] border-primary border-t-transparent motion-reduce:animate-none" />
        <div className="flex flex-col gap-2">
          <h2 id="order-pending-title" tabIndex={-1} className="text-title-sm font-bold outline-none md:text-title">
            Processando seu pagamento…
          </h2>
          <p className="text-body text-text-secondary">
            Aguardando a confirmação na rede {NETWORK_LABELS[order.network]}. Você pode recarregar ou sair desta página com segurança: o
            pedido continua sendo processado e o status é atualizado automaticamente.
          </p>
          <p className="text-caption text-sand">
            Pedido <span className="font-bold text-text-secondary">{order.id}</span>
          </p>
        </div>
      </div>
      <OrderLines order={order} />
    </section>
  )
}

export function OrderDeclined({ order }: { order: Order }) {
  return (
    <section aria-labelledby="order-declined-title" className="flex flex-col gap-6 rounded-lg border border-destructive/50 bg-card/60 p-6 md:p-8" data-testid="order-declined">
      <div role="alert" className="flex items-start gap-4">
        <WarningIcon width={24} height={24} className="mt-1 shrink-0 text-destructive" />
        <div className="flex flex-col gap-2">
          <h2 id="order-declined-title" tabIndex={-1} className="text-title-sm font-bold outline-none md:text-title">
            Pagamento recusado
          </h2>
          <p className="text-body text-foreground" data-testid="order-failure-reason">
            {order.failureReason ?? 'A transação não foi concluída.'}
          </p>
          <p className="text-body text-text-secondary">Nenhum valor foi cobrado. Seus itens continuam no carrinho e o estoque reservado foi liberado.</p>
        </div>
      </div>
      <OrderLines order={order} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link to="/carrinho" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
          Voltar ao carrinho
        </Link>
        <Link to="/pagamento" className={cn(buttonVariants({ size: 'lg' }))} data-testid="order-retry-checkout">
          Tentar novamente
        </Link>
      </div>
    </section>
  )
}

export function OrderNotFound() {
  return (
    <section className="flex flex-col items-center gap-4 rounded-lg bg-card px-6 py-16 text-center" data-testid="order-not-found" aria-labelledby="order-nf-title">
      <h2 id="order-nf-title" className="text-title font-bold">
        Pedido não encontrado
      </h2>
      <p className="max-w-md text-body text-text-secondary">Verifique o link ou acesse seus pedidos a partir do carrinho e do perfil.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/" className={cn(buttonVariants({ size: 'lg' }))}>
          Ir para o início
        </Link>
        <Link to="/carrinho" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
          Ver carrinho
        </Link>
      </div>
    </section>
  )
}

export function OrderError({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying: boolean }) {
  return (
    <section role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-6" data-testid="order-error">
      <h2 className="text-title-sm font-bold">Não foi possível carregar o pedido.</h2>
      <p className="text-body text-text-secondary">{message}</p>
      <Button type="button" variant="outline" onClick={onRetry} loading={retrying}>
        Tentar novamente
      </Button>
    </section>
  )
}

export function OrderSkeleton() {
  return (
    <div role="status" aria-label="Carregando pedido" className="flex flex-col gap-6 rounded-lg border border-border p-6 md:p-8">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-4 w-full max-w-lg" />
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  )
}
