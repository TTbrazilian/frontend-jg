import { Link } from '@tanstack/react-router'
import type { CollectorInfo, Quote, Wallet } from '@/api/contracts'
import { NETWORK_LABELS, WALLET_PROVIDER_LABELS } from '@/api/contracts'
import { WarningIcon } from '@/components/icons'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { EthValue } from '@/features/cart/components/quote-totals'
import { compareEth } from '@/lib/money'
import { cn, shortAddress } from '@/lib/utils'

export type ReviewPhase = 'idle' | 'acknowledging' | 'revalidating' | 'submitting'

export interface ReviewState {
  quote: Quote
  /** Diferenças em relação à cotação revisada antes (vazio na 1ª revisão). */
  changes: string[]
  notice?: string
  error?: string
}

interface ReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  review: ReviewState | null
  phase: ReviewPhase
  /** Pedido demorou (timeout): reenvio automático com a mesma chave em andamento. */
  checking: boolean
  wallet: Wallet | undefined
  collector: CollectorInfo | null
  onConfirm: () => void
}

/**
 * Revisão final antes de criar o pedido: valores da cotação, carteira e dados do colecionador.
 * Ao confirmar, a página revalida a cotação; se algo mudou, este diálogo mostra as diferenças
 * (`review-changes`) e exige nova confirmação.
 */
export function ReviewDialog({ open, onOpenChange, review, phase, checking, wallet, collector, onConfirm }: ReviewDialogProps) {
  const busy = phase !== 'idle'
  const quote = review?.quote
  const empty = !!quote && quote.lines.length === 0
  const hasIssues = !!quote && quote.issues.length > 0
  const hasDiscount = !!quote && compareEth(quote.discountEth, '0') > 0
  const changed = !!review && review.changes.length > 0

  const confirmLabel = empty
    ? 'Carrinho vazio'
    : hasIssues
      ? 'Aceitar alterações e confirmar'
      : changed
        ? 'Confirmar com os novos valores'
        : 'Confirmar compra'

  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogContent
        className="max-w-[560px] gap-0"
        closeLabel="Fechar revisão"
        hideClose={busy}
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
        onInteractOutside={(e) => busy && e.preventDefault()}
        data-testid="review-dialog"
        aria-busy={busy || undefined}
      >
        <div className="flex flex-col gap-2 px-6 pb-4 pt-8">
          <DialogTitle>{changed ? 'A cotação mudou' : 'Revise sua compra'}</DialogTitle>
          <DialogDescription>
            {changed ? 'Confira as diferenças e confirme novamente para continuar.' : 'Confira os valores e a carteira antes de confirmar.'}
          </DialogDescription>
        </div>

        {review && (changed || review.notice) ? (
          <div
            role="alert"
            className="mx-6 mb-4 flex flex-col gap-2 rounded-md border border-amber/50 bg-amber/10 p-3 text-body"
            data-testid="review-changes"
          >
            <p className="flex items-start gap-2 font-bold">
              <WarningIcon width={16} height={16} className="mt-0.5 shrink-0 text-amber" />
              {review.notice ?? 'Valores atualizados pelo servidor:'}
            </p>
            {changed ? (
              <ul className="ml-6 list-disc text-caption text-text-secondary">
                {review.changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {quote ? (
          <div className="flex flex-col gap-4 px-6">
            <ul className="flex flex-col gap-2" aria-label="Itens">
              {quote.lines.map((l) => {
                const issue = quote.issues.find((i) => i.itemId === l.itemId)
                return (
                  <li key={l.itemId} className="flex items-start justify-between gap-3 border-b border-border pb-2 text-body">
                    <span className="min-w-0">
                      <span className="font-bold">{l.title}</span>
                      <span className="block text-caption text-text-secondary">
                        Edição {l.editionLabel} · {l.quantity} × <EthValue value={l.unitPriceEth} />
                      </span>
                      {issue ? (
                        <span className="mt-1 flex items-start gap-1 text-caption font-medium text-amber">
                          <WarningIcon width={12} height={12} className="mt-0.5 shrink-0" />
                          {issue.message}
                        </span>
                      ) : null}
                    </span>
                    <EthValue value={l.lineTotalEth} className="shrink-0 font-bold text-text-accent" />
                  </li>
                )
              })}
            </ul>
            <dl className="flex flex-col gap-1.5 text-body">
              <Row label="Subtotal">
                <EthValue value={quote.subtotalEth} />
              </Row>
              {hasDiscount ? (
                <Row label={`Desconto${quote.coupon ? ` (${quote.coupon.code})` : ''}`}>
                  <EthValue value={quote.discountEth} prefix="(-)" className="text-success" />
                </Row>
              ) : null}
              <Row label={`Taxa de rede (${NETWORK_LABELS[quote.network]})`}>
                <EthValue value={quote.networkFeeEth} />
              </Row>
              <Row label="Total" strong>
                <EthValue value={quote.totalEth} className="text-title-sm font-bold text-text-accent" testId="review-total" />
              </Row>
            </dl>
            {wallet || collector ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-surface-raised p-3 text-caption">
                {wallet ? (
                  <>
                    <dt className="text-text-secondary">Carteira</dt>
                    <dd>
                      {collector?.useOtherWallet
                        ? `Outra carteira · ${WALLET_PROVIDER_LABELS[collector.walletType]} · ${shortAddress(collector.walletAddress, 4)}`
                        : `${wallet.nickname} · ${WALLET_PROVIDER_LABELS[wallet.provider]} · ${shortAddress(wallet.address, 4)}`}
                    </dd>
                  </>
                ) : null}
                {collector ? (
                  <>
                    <dt className="text-text-secondary">Colecionador</dt>
                    <dd>
                      {collector.displayName} (@{collector.username}) · {collector.email}
                    </dd>
                  </>
                ) : null}
              </dl>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 px-6 pb-6 pt-5">
          {checking ? (
            <p role="status" className="flex items-center gap-2 text-body text-text-secondary" data-testid="order-checking">
              <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none" />
              Verificando o status do pedido…
            </p>
          ) : null}
          {review?.error ? (
            <p role="alert" className="flex items-start gap-2 text-body text-destructive" data-testid="review-error">
              <WarningIcon width={16} height={16} className="mt-0.5 shrink-0" />
              {review.error}
            </p>
          ) : null}
          {empty ? (
            <Link to="/carrinho" className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>
              Voltar ao carrinho
            </Link>
          ) : (
            <Button type="button" size="lg" onClick={onConfirm} loading={busy} className="w-full rounded-lg" data-testid="review-confirm">
              {phase === 'revalidating'
                ? 'Revalidando cotação…'
                : phase === 'acknowledging'
                  ? 'Atualizando carrinho…'
                  : phase === 'submitting'
                    ? 'Criando pedido…'
                    : confirmLabel}
            </Button>
          )}
          {!busy ? (
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
              Voltar e editar
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, strong, children }: { label: string; strong?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn(strong && 'text-body-lg font-bold')}>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
